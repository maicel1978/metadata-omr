# ⚖️ Clinical VarOps v4.1 (Enterprise Edition)

## 🎯 Overview
**Clinical VarOps** is a high-fidelity metadata standardization engine designed for clinical research. It bridges the gap between clinical protocol design and data engineering by providing a "Single Source of Truth" (SSoT) for research variables.

## 🏗️ Architecture
- **Paradigm:** Reactive State-Driven SPA (Single Page Application).
- **Core Engine:** Vanilla JavaScript ES6+ (No external framework dependencies for maximum longevity).
- **Styling:** Tailwind CSS 3.0 via CDN (Optimized for zero-config deployment).
- **Persistence:** Encrypted-safe LocalStorage with `.clinical` proprietary export format.

## 🚀 Key Features
1. **Intelligent Clinical Library:** Pre-configured clinical templates (Sex, Age, Hypertension, Diabetes) with built-in validation.
2. **Data Cleaning Engine:** Mapping of synonyms and outlier range protection (Min/Max).
3. **Table-First Design:** Direct-to-thesis APA/Vancouver compliant table generator.
4. **Methodological Stability:** Strict field validation and variable reordering logic.

## 📂 Project Structure
- `index.html`: Optimized UI structure and global styling.
- `app.js`: Production-ready logic, state management, and clinical data dictionary.

## 🔒 Security & Performance
- **Zero-Latency Render:** Efficient DOM manipulation for large variable sets.
- **Client-Side Data Privacy:** No data ever leaves the researcher's browser.
- **Input Sanitization:** Automated `snake_case` conversion for database compatibility.

## ⚖️ License
MIT License - Proprietary for Clinical Research Integrity.
