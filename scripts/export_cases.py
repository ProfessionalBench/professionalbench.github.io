#!/usr/bin/env python3
"""Export recorded benchmark cases. No model calls, scoring, or generated steps.

Run: python3 scripts/export_cases.py --workspace /path/to/ICLR-0
Only conversation payloads are published; runtime/config/telemetry are excluded.
"""
import argparse
import ast
import base64
import collections
import hashlib
import json
import re
import shutil
import zipfile
from datetime import datetime, timezone
from pathlib import Path
import xml.etree.ElementTree as ET

SITE = Path(__file__).resolve().parents[1]
COUNTS = collections.Counter()
SECRET_RULES = [
    ("token", re.compile(r"\b(?:sk-(?:proj-|ant-)?|gh[pousr]_|github_pat_)[A-Za-z0-9_\-]{18,}"), "[credential redacted]"),
    ("authorization", re.compile(r"(?i)(\b(?:authorization|x-api-key)[\"']?\s*[:=]\s*[\"']?)(?:Bearer\s+)?[A-Za-z0-9_./+\-=]{16,}"), r"\1[credential redacted]"),
    ("assignment", re.compile(r"(?i)(\b[A-Z_]*(?:API_KEY|ACCESS_TOKEN|AUTH_TOKEN|SECRET_KEY|PASSWORD)[\"']?\s*[:=]\s*[\"']?)(?!\[credential)([A-Za-z0-9_./+\-=]{16,})"), r"\1[credential redacted]"),
    ("url_credential", re.compile(r"(?i)([?&](?:api_key|access_token|token)=)[^\s&\"'<>]+"), r"\1[credential redacted]"),
    ("host_path", re.compile(r"/(?:Users|home)/[A-Za-z0-9_.\-\u4e00-\u9fff]+/"), "/[local-user]/"),
]


def clean(value):
    text = str(value or "")
    for name, regex, replacement in SECRET_RULES:
        text, count = regex.subn(replacement, text)
        COUNTS[name] += count
    return text


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def dump(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n")


class Content:
    def __init__(self):
        self.images = 0

    def image(self, value, mime="image/png"):
        try:
            if value.startswith("data:"):
                header, value = value.split(",", 1)
                mime = header[5:].split(";")[0]
            data = base64.b64decode(value, validate=True)
            ext = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif"}.get(mime)
            if not ext:
                return "[Embedded binary omitted from text replay]"
            name = hashlib.sha256(data).hexdigest() + "." + ext
            path = SITE / "cases/media" / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
            self.images += 1
            return {"type": "image", "href": "cases/media/" + name, "label": "Recorded image observation"}
        except (ValueError, TypeError):
            return "[Embedded image could not be decoded]"

    def text(self, value):
        if isinstance(value, str):
            if value.startswith("data:image/"):
                result = self.image(value)
                return "[Recorded image: " + result["href"] + "]" if isinstance(result, dict) else result
            if (value.startswith("[{'type':") or value.startswith('[{"type":') or value.startswith('{"type":')) and len(value) < 12_000_000:
                try:
                    parsed = json.loads(value) if value[1:2] == '"' or value.startswith('[{"') else ast.literal_eval(value)
                    return self.text(parsed)
                except (ValueError, SyntaxError):
                    pass
            return clean(value)
        if isinstance(value, list):
            return "\n".join(self.text(v) for v in value)
        if isinstance(value, dict):
            if value.get("type") in ("image", "image_url"):
                source = value.get("source") or value.get("image_url") or value
                if isinstance(source, str):
                    result = self.image(source)
                else:
                    result = self.image(source.get("data") or source.get("url") or "", source.get("media_type", "image/png"))
                return "[Recorded image: " + result["href"] + "]" if isinstance(result, dict) else result
            if "text" in value:
                return self.text(value["text"])
            return clean(json.dumps(value, ensure_ascii=False, indent=2))
        return clean(value)

    def blocks(self, values):
        if isinstance(values, str):
            return [{"type": "message", "text": self.text(values)}] if values else []
        result = []
        reasoning_keys = {v.get("reasoningKey") for v in values if isinstance(v, dict) and v.get("type") == "think"}
        for v in values or []:
            if not isinstance(v, dict):
                result.append({"type": "message", "text": self.text(v)})
                continue
            typ = v.get("type")
            if typ == "think" and "reasoning_content" in reasoning_keys and v.get("reasoningKey") != "reasoning_content":
                continue  # Kimi mirrors the same streaming text under two keys.
            if typ in ("thinking", "think") or v.get("thought"):
                block = {"type": "reasoning", "text": self.text(v.get("thinking", v.get("think", v.get("text", ""))))}
            elif typ == "tool_use" or "functionCall" in v:
                f = v.get("functionCall", v)
                block = {"type": "call", "name": f.get("name", "Tool"), "call_id": f.get("id"), "text": self.text(f.get("input", f.get("args", {})))}
            elif typ == "tool_result" or "functionResponse" in v:
                f = v.get("functionResponse", v)
                block = {"type": "observation", "name": f.get("name", "Tool result"), "call_id": f.get("tool_use_id", f.get("id")), "text": self.text(f.get("content", f.get("response", {}))), "error": bool(f.get("is_error"))}
            elif typ in ("image", "image_url"):
                block = {"type": "observation", "text": self.text(v)}
            else:
                block = {"type": "message", "text": self.text(v.get("text", v))}
            if result and block["type"] in ("message", "reasoning") and result[-1]["type"] == block["type"]:
                result[-1]["text"] += block["text"]
            else:
                result.append(block)
        return result


def timestamp(value):
    if isinstance(value, (float, int)):
        return datetime.fromtimestamp(value / 1000, timezone.utc).isoformat()
    return value or ""


def events_from(path, fmt, session, run_dir, content):
    result = []
    source = str(path.relative_to(run_dir))
    rows = json.loads(path.read_text())["steps"] if fmt == "structured" else [json.loads(x) for x in path.read_text().splitlines() if x.strip()]
    for index, row in enumerate(rows, 1):
        blocks = []
        if fmt == "structured":
            role = {"agent": "assistant"}.get(row.get("source"), row.get("source", "assistant"))
            blocks = content.blocks(row.get("message", ""))
            if row.get("reasoning_content"):
                blocks.append({"type": "reasoning", "text": content.text(row["reasoning_content"])})
            for call in row.get("tool_calls", []):
                blocks.append({"type": "call", "name": call.get("function_name", "Tool"), "call_id": call.get("tool_call_id"), "text": content.text(call.get("arguments", {}))})
            for ob in (row.get("observation") or {}).get("results", []):
                blocks.append({"type": "observation", "text": content.text(ob.get("content", "")), "call_id": ob.get("source_call_id"), "error": bool((ob.get("extra") or {}).get("tool_result_is_error"))})
            location = "step " + str(row["step_id"])
            time = row.get("timestamp")
        elif fmt == "kimi":
            if row.get("type") != "agent.message.appended":
                continue
            message = row["message"]["message"]
            role = message.get("role", "assistant")
            blocks = content.blocks(message.get("content", []))
            if role == "tool":
                for b in blocks:
                    if b["type"] == "message":
                        b["type"] = "observation"
                    b["call_id"] = message.get("toolCallId")
            for call in message.get("toolCalls", []):
                blocks.append({"type": "call", "name": call.get("name", "Tool"), "call_id": call.get("id"), "text": content.text(call.get("arguments", {}))})
            location, time = "line " + str(index), row.get("time")
        else:
            if row.get("type") not in ("user", "assistant", "tool_result"):
                continue
            message = row.get("message", {})
            role = "tool" if row["type"] == "tool_result" else row["type"]
            blocks = content.blocks(message.get("parts", message.get("content", [])))
            if blocks and all(b["type"] == "observation" for b in blocks):
                role = "tool"
            location, time = "line " + str(index), row.get("timestamp")
        if not blocks:
            continue
        tools = list(dict.fromkeys(b.get("name", "Tool") for b in blocks if b["type"] == "call"))
        kind = "tool" if tools else "observation" if role == "tool" else "prompt" if role == "user" else "setup" if role == "system" else "message"
        title = " · ".join(tools) if tools else {"observation": "Tool result", "prompt": "Task / instruction", "setup": "Session setup", "message": "Assistant message"}[kind]
        preview = ""
        if tools:
            call = next(b for b in blocks if b["type"] == "call")
            try:
                args = json.loads(call["text"])
                if isinstance(args, dict):
                    preview = args.get("description") or args.get("cmd") or args.get("command") or args.get("path") or args.get("query") or ""
            except (ValueError, TypeError):
                preview = call["text"]
        if not preview:
            preview = next((b.get("text", "") for b in blocks if b["type"] == "message"), "")
        preview = re.sub(r"\s+", " ", str(preview)).strip()[:160]
        result.append({"session": session, "timestamp": timestamp(time), "role": role, "kind": kind, "title": clean(title), "preview": clean(preview), "source": source + " · " + location, "blocks": blocks})
    return result


def docx_text(path):
    with zipfile.ZipFile(path) as z:
        root = ET.fromstring(z.read("word/document.xml"))
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    return "\n\n".join("".join(t.text or "" for t in p.findall(".//w:t", ns)) for p in root.findall(".//w:p", ns))


INFO = {
    "Finance": {"id": "finance", "folder": "金融", "title": "Home-purchase planning", "summary": "Balance a school-transfer deadline, declining house prices, loan eligibility, and household cash flow.", "outputs": "Four Markdown files: plan, sources, execution log, and independent review.", "focus": "Policy evidence → financing scenarios → consistent final numbers", "default": "codex-gpt56"},
    "Legal": {"id": "legal", "folder": "法律", "title": "Trade-secret investigation", "summary": "Turn five case files into a privilege-aware interview plan for three witness groups.", "outputs": "One English witness-interview memorandum (result.docx), with source and evidentiary purpose after every question.", "focus": "Source authority → witness-specific questions → usable interview plan", "default": "codex-gpt56"},
    "Healthcare": {"id": "healthcare", "folder": "医疗", "title": "Endocrine admission assessment", "summary": "Build an emergency-first, staged assessment while distinguishing historical findings from current evidence.", "outputs": "One clinical assessment DOCX and three supporting Markdown records.", "focus": "Clinical evidence → safe test sequence → cross-file verification", "default": "codex-gpt56"},
}
MODEL_IDS = ["codex-gpt56", "cc-opus5", "kimi-k3", "qwen38-code", "gemini38-flash", "cc-deepseek", "cc-glm"]
LOGOS = ["openai", "anthropic", "kimi", "qwen", "gemini", "deepseek", "glm"]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", type=Path, required=True)
    args = parser.parse_args()
    workspace = args.workspace.resolve()
    selection = json.loads((workspace / "ProfessionalBench_Evaluation/showcase_selection_20261014/selection.json").read_text())
    manifest = {"schema": "professionalbench-replays-v1", "score_note": "Archived Unified Outcome Score = score_normalized × 100. No rejudging. A score alone does not establish Professional Pass.", "replay_note": "All retained conversation messages, tool calls and observations from the listed sources. Runtime telemetry/configuration is excluded; credentials and local usernames are redacted. Mirrored Kimi reasoning chunks are deduplicated. Playback advances recorded events; it does not rerun tools. Original languages are preserved.", "cases": []}
    audit = {"cases": [], "source_hashes": {}, "redactions": {}}
    for candidate in selection["recommended_cases"]:
        info = INFO[candidate["domain"]]
        task = workspace / "ProfessionalBench/AAA_final_unified_tasks" / info["folder"] / "items" / (candidate["task_id"] + "__unified")
        instruction = task.joinpath("instruction.md").read_text().strip()
        definitions = {str(r["id"]): r for r in json.loads(task.joinpath("tests/rubric.json").read_text())["rubrics"]}
        case = {k: v for k, v in info.items() if k not in ("folder",)}
        case.update(task_id=candidate["task_id"], domain=candidate["domain"], instruction=clean(instruction), inputs=[p.name for p in sorted(task.joinpath("data/input_files").rglob("*")) if p.is_file()], runs=[])
        for row in candidate["runs"]:
            model = next(k for k in MODEL_IDS if k in row["job"])
            base = workspace / Path(row["score_source"]["path"]).parents[1]
            content = Content()
            if model == "kimi-k3":
                sources = [(p, "kimi", p.parent.name) for p in sorted(base.glob("agent/**/wire.jsonl"))]
            elif model == "qwen38-code":
                sources = [(p, "qwen", "main" if "/chats/" in str(p) else "subagent-" + str(i)) for i, p in enumerate(sorted(base.glob("agent/qwen-sessions/**/*.jsonl")))]
            elif model.startswith("cc-"):
                paths = sorted(base.glob("agent/sessions/**/*.jsonl"))
                sources = [(p, "claude", "subagent-" + str(i) if "/subagents/" in str(p) else "main") for i, p in enumerate(paths)]
            else:
                sources = [(base / "agent/trajectory.json", "structured", "main")]
            assert sources, (candidate["task_id"], model)
            events, origin = [], []
            for path, fmt, session in sources:
                events.extend(events_from(path, fmt, session, base, content))
                key = row["job"] + "/" + row["run_id"] + "/" + str(path.relative_to(base))
                audit["source_hashes"][key] = sha(path)
                origin.append({"file": str(path.relative_to(base)), "sha256": sha(path), "format": fmt, "session": session})
            events.sort(key=lambda e: e["timestamp"])
            for i, event in enumerate(events):
                event["id"] = i + 1
            prompt_verified = any(instruction in b["text"] for e in events if e["role"] == "user" for b in e["blocks"])
            assert prompt_verified, (candidate["task_id"], model, "task not found in archived user prompt")
            verifier = json.loads(base.joinpath("verifier/result.json").read_text())
            score = verifier.get("score_normalized", verifier.get("reward"))
            assert score == row["score_normalized"]
            details = verifier.get("details", {})
            criteria = details if isinstance(details, list) else details.get("criteria", details.get("results", []))
            rubric = []
            for c in criteria:
                cid = str(c.get("id", c.get("rubric_number")))
                definition = definitions.get(cid, {})
                weight = float(c.get("weight", definition.get("weight", 0)))
                hurdle = c.get("hurdle", definition.get("hurdle", False))
                hit = c.get("hit", c.get("passed"))
                judged = c.get("judged") is not False and hit is not None
                status = "unjudged" if not judged else ("triggered" if hit else "clear") if hurdle or weight < 0 else "met" if hit else "unmet" if weight > 0 else "informational"
                rubric.append({"id": cid, "weight": weight, "hurdle": hurdle, "hit": hit, "status": status, "criterion": clean(c.get("detail") or c.get("description") or definition.get("criterion", "")), "reason": clean(c.get("justification") or c.get("reason", ""))})
            failure_count = sum(c["status"] in ("unmet", "triggered") for c in rubric)
            dest = SITE / "cases" / info["id"] / model
            dest.mkdir(parents=True, exist_ok=True)
            files = []
            for item in row["deliverables"]:
                p = workspace / item["path"]
                assert sha(p) == item["sha256"], p
                text = p.read_text() if p.suffix == ".md" else docx_text(p) if p.suffix == ".docx" else ""
                before = dict(COUNTS)
                preview = clean(text)
                if preview != text:
                    raise ValueError("Submitted artifact requires explicit sanitization before publication: " + p.name)
                target = dest / "files" / p.name
                target.parent.mkdir(exist_ok=True)
                shutil.copyfile(p, target)
                files.append({"name": p.name, "href": str(target.relative_to(SITE)), "bytes": p.stat().st_size, "sha256": sha(p), "format": p.suffix[1:].upper(), "preview": preview, "preview_note": "Text extracted from the submitted DOCX; download preserves the original layout." if p.suffix == ".docx" else "Submitted Markdown source."})
            session_counts = collections.Counter(e["session"] for e in events)
            stats = {"events": len(events), "sessions": dict(session_counts), "tool_calls": sum(b["type"] == "call" for e in events for b in e["blocks"]), "observations": sum(b["type"] == "observation" for e in events for b in e["blocks"]), "characters": sum(len(b.get("text", "")) for e in events for b in e["blocks"])}
            notes = []
            if not files:
                notes.append("The archived output directory is empty. The recorded score is 0; this is not a missing score.")
            if len(session_counts) > 1:
                notes.append("Includes the main conversation and retained subagent conversations, merged by recorded timestamp. Use the session filter to follow one thread.")
            if model == "qwen38-code" and info["id"] == "finance":
                notes.append("Reconstructed from the native main and five subagent logs. The original standard trajectory export covered only one subagent.")
            run = {"model_id": model, "model": row["model"], "run_id": row["run_id"], "score": round(score * 100, 4), "score_normalized": score, "stats": stats, "failure_count": failure_count, "file_count": len(files), "href": f"cases/{info['id']}/{model}/run.json", "notes": notes}
            data = {**run, "events": events, "rubric": rubric, "files": files, "sources": origin, "score_source": {"file": "verifier/result.json", "sha256": sha(base / "verifier/result.json"), "status": verifier.get("status"), "hurdle_triggered": verifier.get("is_hit_hurdle")}, "prompt_verified": prompt_verified}
            dump(dest / "run.json", data)
            run["bytes"] = (dest / "run.json").stat().st_size
            case["runs"].append(run)
            print(info["id"], model, stats["events"], "events", len(session_counts), "sessions", round(run["bytes"] / 1024), "KB")
        manifest["cases"].append(case)
        audit["cases"].append({"id": info["id"], "runs": len(case["runs"]), "instruction_sha256": sha(task / "instruction.md")})
    audit["redactions"] = dict(COUNTS)
    dump(SITE / "cases/manifest.json", manifest)
    dump(SITE / "cases/provenance.json", audit)
    print("Redactions:", dict(COUNTS))


if __name__ == "__main__":
    main()
