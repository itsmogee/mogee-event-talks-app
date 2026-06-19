# 📊 BigQuery Release Notes Hub

A beautiful, interactive web application built with **Python Flask** and **Vanilla HTML, CSS, and JS**. It fetches, parses, and caches the official Google Cloud BigQuery Release Notes feed, offering a premium social sharing experience with character-limit validation for posting updates to X (formerly Twitter).

---

## ✨ Features

- **🌐 Live RSS Synchronization**: Fetches and parses the official BigQuery release notes XML feed.
- **⚡ In-Memory Caching**: Caches feed items for 5 minutes to optimize performance, with a manual "Refresh" button that bypasses cache when clicked.
- **🔍 Text Search & Type Filtering**: Quickly search updates by keyword or filter them by category (Features, Announcements, Issues, Others).
- **💡 Dynamic Metrics**: Animated statistics widgets that show counts of different update types.
- **📱 Responsive Glassmorphic UI**: High-contrast, modern UI featuring glowing radial gradients and sticky timelines.
- **🐦 X/Twitter Web Intent Integration**: Select an update card to open a custom Tweet Composer. It automatically drafts the update text (truncating if it exceeds 280 characters), appends hashtags and links, and tracks typing length with a circular visual SVG progress bar.

---

## 🛠️ Technology Stack

- **Backend**: Python, Flask, Feedparser, Requests
- **Frontend**: Vanilla HTML5, CSS3, ES6 JavaScript (No heavy frameworks or Tailwind dependencies)

---

## 🚀 Quick Start

### 1. Pre-requisites
Ensure you have Python 3 installed.

### 2. Installation
Clone the repository and install dependencies:
```bash
# Create environment
python -m venv .venv

# Activate (Windows)
.venv\Scripts\activate

# Install requirements
pip install flask requests feedparser
```

### 3. Running the Server
Run the Flask backend server:
```bash
python app.py
```
Open your browser and navigate to `http://127.0.0.1:5000`.
