# System Instructions: Lab Report Interpreter

## 🧭 Project Overview

Build a **lab report interpretation web application** that converts complex medical lab results into **simple, human-readable explanations**.

The application must strictly function as an **educational tool**, NOT a diagnostic or treatment system.

---

## ⚠️ Core Safety Principles (MANDATORY)

* NEVER provide medical diagnosis
* NEVER suggest medications or dosages
* NEVER replace professional medical advice
* ALWAYS include disclaimer: "Consult your doctor for medical decisions"
* Use cautious language (e.g., "may indicate", "could suggest")

---

## 🎯 Core Features

### 1. PDF Upload & Parsing

* Upload lab report (PDF)
* Extract:

  * Test name
  * Value
  * Reference range
  * Units

---

### 2. Lab Interpretation Engine

For each lab value:

* Plain-English explanation
* What the test measures
* Whether it is:

  * Normal
  * Slightly high/low
  * Significantly abnormal
* Possible general reasons (non-diagnostic)
* When to follow up

Example:

> eGFR: 58
> "Your kidney filtration is slightly lower than typical. This can happen due to aging, dehydration, or underlying conditions. Your doctor may monitor this over time."

---

### 3. Risk Highlighting

* Highlight abnormal values
* Categorize:

  * Green (Normal)
  * Yellow (Watch)
  * Red (Discuss soon)

---

### 4. Summary Section

* Overall easy summary:

  * "Most values are within range"
  * "Some values may need discussion"

---

### 5. Doctor Discussion Prep

* Generate questions like:

  * "Should I repeat this test?"
  * "Is this temporary or chronic?"

---

## 🧩 UI Structure

### Pages:

* Home (Upload)
* Results Dashboard
* History (optional)
* Settings

---

### Dashboard Components:

* Lab Cards
* Summary Box
* Risk Indicators
* Explanation Panels

---

## ⚙️ Tech Stack

### Frontend:

* React / Next.js
* Tailwind CSS

### Backend:

* Node.js / Express

### AI:

* LLM (OpenAI or similar)
* Structured prompt-based interpretation

### PDF Parsing:

* pdf-parse or similar

---

## 🔐 Compliance & Safety

* No PHI storage unless encrypted
* Temporary processing preferred
* Add clear disclaimers everywhere
* Avoid storing user medical history by default

---

## 🚀 Future Features

* OCR for scanned reports
* Multi-language support
* Trends over time
* Integration with lab providers

---

## 🧪 Testing Requirements

* Handle messy PDFs
* Validate incorrect units
* Ensure no hallucinated medical advice

---

## 🎯 Goal

Deliver a **safe, accurate, understandable lab explanation tool** that empowers users without replacing doctors.
