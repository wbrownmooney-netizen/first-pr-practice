# first-pr-practice

A small practice repository for learning the GitHub pull request workflow.

## What this is

This repo exists so you can practice the full loop of making a change,
opening a pull request, and merging it — without any risk to a real project.

## The app

`index.html` is a tiny standalone web app — a "PRs Shipped" counter that
saves its count in your browser's local storage. No build step or
dependencies required.

To run it, just open `index.html` in a browser, or serve the folder locally:

```
python -m http.server 8000
```

then visit `http://localhost:8000`.

## Getting started

1. Clone the repo: `git clone https://github.com/wbrownmooney-netizen/first-pr-practice.git`
2. Create a branch for your change: `git checkout -b my-change`
3. Make your edit, commit it, and push the branch
4. Open a pull request against `main`
