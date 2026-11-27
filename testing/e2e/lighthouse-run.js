const fs = require("node:fs");
const path = require("node:path");

(async () => {
  const lighthouse = (await import("lighthouse")).default;
  const chromeLauncher = await import("chrome-launcher");
  fs.mkdirSync(path.resolve("reports"), { recursive: true });
  fs.mkdirSync(path.resolve("screenshots"), { recursive: true });

  const chrome = await chromeLauncher.launch({
    chromeFlags: ["--headless", "--no-sandbox", "--disable-gpu"],
  });
  try {
    const url = process.argv[2] || "http://localhost:4000/login";
    const result = await lighthouse(url, {
      port: chrome.port,
      output: ["json", "html"],
      logLevel: "info",
      onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
    });
    if (!result) throw new Error("Lighthouse returned no result");
    fs.writeFileSync(
      path.resolve("reports/lighthouse.json"),
      result.report[0],
    );
    fs.writeFileSync(
      path.resolve("reports/lighthouse.html"),
      result.report[1],
    );
    const categories = result.lhr.categories;
    const summary = {
      url,
      lighthouseVersion: result.lhr.lighthouseVersion,
      scores: {
        performance: categories.performance?.score,
        accessibility: categories.accessibility?.score,
        bestPractices: categories["best-practices"]?.score,
        seo: categories.seo?.score,
      },
    };
    fs.writeFileSync(
      path.resolve("reports/lighthouse-summary.json"),
      JSON.stringify(summary, null, 2),
    );
    console.log(JSON.stringify(summary));
  } finally {
    await chrome.kill();
  }
})();
