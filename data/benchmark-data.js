window.PROFESSIONAL_BENCH = {
  "meta": {
    "title": "ProfessionalBench",
    "paperTitle": "ProfessionalBench: Benchmarking AI Agents on Real-World Professional Workflows",
    "institution": "Humanlaya Data",
    "manuscriptDate": "2026-10-14",
    "paper": "assets/professionalbench-paper.pdf?v=20261014-paper39",
    "repository": "https://github.com/ProfessionalBench",
    "evaluationTasks": 90,
    "tasksPerDomain": 30,
    "source": "Supplied manuscript, October 14, 2026. Table 2: p. 6; Table 3: p. 8; Tables 1 and 5: pp. 5 and 15; Table 6: p. 16.",
    "citation": "@misc{humanlaya2026professionalbench,\n  title  = {ProfessionalBench: Benchmarking AI Agents on\n            Real-World Professional Workflows},\n  author = {{Humanlaya Data}},\n  year   = {2026},\n  month  = oct,\n  note   = {Manuscript, October 14, 2026}\n}"
  },
  "stats": {
    "tasks": 435,
    "subdomains": 30,
    "units": 127,
    "workflows": 355,
    "inputs": 8308,
    "deliverables": 1880,
    "rubrics": 15109
  },
  "models": [
    {
      "id": "gpt",
      "name": "GPT-5.6 Sol",
      "company": "OpenAI",
      "mark": "OA",
      "harness": "Codex CLI",
      "harnessVersion": "0.154.0",
      "color": "#8cac95",
      "logo": "assets/logos/openai.svg",
      "results": {
        "finance": {
          "score": 60.83,
          "pass": 36.7,
          "delay": 5.38,
          "cost": 1.78
        },
        "legal": {
          "score": 63.11,
          "pass": 30.0,
          "delay": 13.32,
          "cost": 4.46
        },
        "healthcare": {
          "score": 66.98,
          "pass": 33.3,
          "delay": 6.58,
          "cost": 1.76
        },
        "overall": {
          "score": 63.64,
          "pass": 33.3,
          "delay": 8.43,
          "cost": 2.67
        }
      }
    },
    {
      "id": "claude",
      "name": "Claude Opus 5",
      "company": "Anthropic",
      "mark": "A",
      "harness": "Claude Code",
      "harnessVersion": "2.1.272",
      "color": "#7ea2bd",
      "logo": "assets/logos/anthropic.svg",
      "results": {
        "finance": {
          "score": 63.57,
          "pass": 33.3,
          "delay": 14.78,
          "cost": 2.68
        },
        "legal": {
          "score": 60.74,
          "pass": 26.7,
          "delay": 31.35,
          "cost": 4.49
        },
        "healthcare": {
          "score": 64.37,
          "pass": 36.7,
          "delay": 15.95,
          "cost": 2.86
        },
        "overall": {
          "score": 62.89,
          "pass": 32.2,
          "delay": 20.69,
          "cost": 3.34
        }
      }
    },
    {
      "id": "gemini",
      "name": "Gemini 3.8 Flash",
      "company": "Google",
      "mark": "G",
      "harness": "Gemini CLI",
      "harnessVersion": "0.60.0",
      "color": "#a39cbf",
      "logo": "assets/logos/google-color.svg",
      "results": {
        "finance": {
          "score": 42.1,
          "pass": 13.3,
          "delay": 9.78,
          "cost": 0.81
        },
        "legal": {
          "score": 46.53,
          "pass": 10.0,
          "delay": 12.23,
          "cost": 0.84
        },
        "healthcare": {
          "score": 51.14,
          "pass": 16.7,
          "delay": 13.8,
          "cost": 0.71
        },
        "overall": {
          "score": 46.59,
          "pass": 13.3,
          "delay": 11.94,
          "cost": 0.79
        }
      }
    },
    {
      "id": "deepseek",
      "name": "DeepSeek-V4.1-Flash",
      "company": "DeepSeek",
      "mark": "DS",
      "harness": "Claude Code",
      "harnessVersion": "2.1.272",
      "color": "#d3c280",
      "logo": "assets/logos/deepseek-color.svg",
      "results": {
        "finance": {
          "score": 52.04,
          "pass": 6.7,
          "delay": 15.22,
          "cost": 0.25
        },
        "legal": {
          "score": 52.04,
          "pass": 13.3,
          "delay": 30.93,
          "cost": 0.79
        },
        "healthcare": {
          "score": 55.05,
          "pass": 23.3,
          "delay": 11.1,
          "cost": 0.26
        },
        "overall": {
          "score": 53.04,
          "pass": 14.4,
          "delay": 19.08,
          "cost": 0.43
        }
      }
    },
    {
      "id": "glm",
      "name": "GLM-5.2",
      "company": "Z.ai",
      "mark": "Z",
      "harness": "Claude Code",
      "harnessVersion": "2.1.272",
      "color": "#d59795",
      "logo": "assets/logos/zai.svg",
      "results": {
        "finance": {
          "score": 50.16,
          "pass": 10.0,
          "delay": 13.1,
          "cost": 0.49
        },
        "legal": {
          "score": 45.14,
          "pass": 6.7,
          "delay": 10.67,
          "cost": 0.49
        },
        "healthcare": {
          "score": 49.71,
          "pass": 20.0,
          "delay": 9.88,
          "cost": 0.4
        },
        "overall": {
          "score": 48.34,
          "pass": 12.2,
          "delay": 11.22,
          "cost": 0.46
        }
      }
    },
    {
      "id": "qwen",
      "name": "Qwen3.8-Max",
      "company": "Qwen",
      "mark": "Q",
      "harness": "Qwen Code",
      "harnessVersion": "0.24.1",
      "color": "#75afaf",
      "logo": "assets/logos/qwen-color.svg",
      "results": {
        "finance": {
          "score": 53.88,
          "pass": 26.7,
          "delay": 51.4,
          "cost": 2.64
        },
        "legal": {
          "score": 42.47,
          "pass": 6.7,
          "delay": 63.33,
          "cost": 2.11
        },
        "healthcare": {
          "score": 58.82,
          "pass": 23.3,
          "delay": 27.53,
          "cost": 1.43
        },
        "overall": {
          "score": 51.72,
          "pass": 18.9,
          "delay": 47.42,
          "cost": 2.06
        }
      }
    },
    {
      "id": "kimi",
      "name": "Kimi K3",
      "company": "Moonshot AI",
      "mark": "K",
      "harness": "Kimi Code",
      "harnessVersion": "2.0.2",
      "color": "#d4aa8b",
      "logo": "assets/logos/moonshot.svg",
      "results": {
        "finance": {
          "score": 57.82,
          "pass": 20.0,
          "delay": 14.9,
          "cost": 1.43
        },
        "legal": {
          "score": 53.34,
          "pass": 20.0,
          "delay": 38.68,
          "cost": 6.37
        },
        "healthcare": {
          "score": 57.51,
          "pass": 16.7,
          "delay": 12.58,
          "cost": 0.98
        },
        "overall": {
          "score": 56.22,
          "pass": 18.9,
          "delay": 22.05,
          "cost": 2.93
        }
      }
    }
  ],
  "domains": [
    {
      "id": "finance",
      "name": "Finance",
      "tasks": 141,
      "subdomains": 12,
      "units": 41,
      "workflows": 108,
      "inputs": 5174,
      "deliverables": 660,
      "rubrics": 4232,
      "class": "finance",
      "description": "From accounting and credit to investment and financial planning."
    },
    {
      "id": "legal",
      "name": "Law",
      "tasks": 167,
      "subdomains": 10,
      "units": 28,
      "workflows": 134,
      "inputs": 1608,
      "deliverables": 731,
      "rubrics": 6029,
      "class": "legal",
      "description": "From compliance and intellectual property to disputes and corporate work."
    },
    {
      "id": "healthcare",
      "name": "Healthcare",
      "tasks": 127,
      "subdomains": 8,
      "units": 58,
      "workflows": 113,
      "inputs": 1526,
      "deliverables": 489,
      "rubrics": 4848,
      "class": "healthcare",
      "description": "From clinical medicine and pharmacy to public health and medical devices."
    }
  ],
  "compression": [
    {
      "id": "know",
      "name": "Know-compressed",
      "short": "Know",
      "gain": 3.67,
      "failToPass": 11,
      "rate": 12.2,
      "pooledPass": 24.4,
      "scoreIncreases": 59,
      "color": "#28857b",
      "support": "Evidence assessments and professional judgments are supplied.",
      "remaining": "The supplied support can satisfy some criteria directly and alter downstream work.",
      "sourcePage": 8
    },
    {
      "id": "act",
      "name": "Act-compressed",
      "short": "Act",
      "gain": 5.96,
      "failToPass": 14,
      "rate": 15.6,
      "pooledPass": 27.8,
      "scoreIncreases": 55,
      "color": "#4e7fa8",
      "support": "Task-specific plans or execution results are supplied.",
      "remaining": "Providing execution support can change both the remaining work and the observed outcome.",
      "sourcePage": 8
    },
    {
      "id": "close",
      "name": "Close-compressed",
      "short": "Close",
      "gain": 7.8,
      "failToPass": 18,
      "rate": 20.0,
      "pooledPass": 32.2,
      "scoreIncreases": 59,
      "color": "#8469a0",
      "support": "Verification or completion aids are supplied.",
      "remaining": "Higher acceptance does not establish independent fulfillment of the pre-resolved responsibilities.",
      "sourcePage": 8
    }
  ],
  "failures": [
    {
      "name": "Know",
      "value": 25.2,
      "color": "#28857b"
    },
    {
      "name": "Act",
      "value": 38.6,
      "color": "#4e7fa8"
    },
    {
      "name": "Close",
      "value": 34.9,
      "color": "#8469a0"
    },
    {
      "name": "Infrastructure",
      "value": 1.3,
      "color": "#98a6b2"
    }
  ],
  "cases": []
};
