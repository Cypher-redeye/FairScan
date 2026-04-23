/* ════════════════════════════════════════════════════
   FairScan — Application Logic (Real Bias Auditing)
   ════════════════════════════════════════════════════ */

(() => {
  "use strict";

  // ── DOM refs ────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const navBtns        = $$(".nav-btn");
  const screens        = $$(".screen");
  const dropzone       = $("#dropzone");
  const fileInput      = $("#file-input");
  const fileInfo       = $("#file-info");
  const fileName       = $("#file-name");
  const fileSize       = $("#file-size");
  const fileRemove     = $("#file-remove");
  const outcomeCol     = $("#outcome-col");
  const protectedAttr  = $("#protected-attr");
  const runAuditBtn    = $("#run-audit-btn");
  const loadingOverlay = $("#loading-overlay");
  const topbarStatus   = $("#topbar-status");
  const downloadPdf    = $("#download-pdf-btn");
  const tryDemoBtn     = $("#try-demo-btn");
  const demoDivider    = $("#demo-divider");

  let uploadedFile  = null;
  let demoFileName  = null;   // set when demo dataset is loaded
  let parsedData    = null;   // { headers: string[], rows: Record<string,string>[] }
  let chartInstance = null;
  let auditResults  = null;
  let outcomeEncoding = null; // auto-detected encoding for string outcome columns



  // ── Navigation ──────────────────────────────────
  function switchScreen(name) {
    // Guard: don't allow dashboard/report until audit has been run
    if ((name === "dashboard" || name === "report") && !auditResults) {
      showToast("Run a bias audit first to see results.");
      return;
    }

    screens.forEach((s) => s.classList.remove("active"));
    navBtns.forEach((b) => b.classList.remove("active"));
    $(`#screen-${name}`).classList.add("active");
    $(`[data-screen="${name}"]`).classList.add("active");

    if (name === "dashboard") {
      requestAnimationFrame(() => renderChart(auditResults));
    }
  }

  navBtns.forEach((btn) =>
    btn.addEventListener("click", () => switchScreen(btn.dataset.screen))
  );

  // Initially dim the dashboard & report nav buttons
  $("#nav-dashboard").classList.add("nav-locked");
  $("#nav-report").classList.add("nav-locked");

  // ── Toast Notification ─────────────────────────
  function showToast(message) {
    let toast = $("#toast-notification");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "toast-notification";
      toast.className = "toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("toast-visible");
    setTimeout(() => toast.classList.remove("toast-visible"), 3000);
  }

  // ── Drag & Drop ────────────────────────────────
  dropzone.addEventListener("click", () => fileInput.click());
  $("#dropzone-browse").addEventListener("click", (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  ["dragenter", "dragover"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add("drag-over");
    })
  );

  ["dragleave", "drop"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove("drag-over");
    })
  );

  dropzone.addEventListener("drop", (e) => {
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
  });

  fileRemove.addEventListener("click", () => {
    uploadedFile = null;
    demoFileName = null;
    parsedData = null;
    auditResults = null;
    outcomeEncoding = null;
    fileInput.value = "";
    fileInfo.classList.add("hidden");
    dropzone.style.display = "";
    if (demoDivider) demoDivider.style.display = "";
    if (tryDemoBtn) tryDemoBtn.style.display = "";
    resetDropdowns();
    topbarStatus.textContent = "No file uploaded";
    $("#nav-dashboard").classList.add("nav-locked");
    $("#nav-report").classList.add("nav-locked");
  });

  // ── Demo Dataset ───────────────────────────────
  if (tryDemoBtn) {
    tryDemoBtn.addEventListener("click", async () => {
      tryDemoBtn.disabled = true;
      tryDemoBtn.textContent = "Loading demo dataset…";

      try {
        // Fetch the CSV directly from Express static file server (same mechanism as index.html)
        const response = await fetch("/data/UCI_Adult_Income_Dataset.csv");

        if (!response.ok) {
          throw new Error(`Server returned ${response.status}. Is the server running? (npm start)`);
        }

        const text = await response.text();
        parsedData = parseCSV(text);

        if (!parsedData || parsedData.rows.length === 0) {
          throw new Error("Could not parse demo CSV.");
        }

        // Create a synthetic File object for the report
        const blob = new Blob([text], { type: "text/csv" });
        uploadedFile = new File([blob], "UCI_Adult_Income_Dataset.csv", { type: "text/csv" });
        demoFileName = "UCI_Adult_Income_Dataset.csv";

        // Show file info
        fileName.textContent = "UCI_Adult_Income_Dataset.csv";
        fileSize.textContent = formatBytes(blob.size);
        fileInfo.classList.remove("hidden");
        dropzone.style.display = "none";
        if (demoDivider) demoDivider.style.display = "none";
        tryDemoBtn.style.display = "none";
        topbarStatus.textContent = "UCI Adult Income Dataset";

        // Populate dropdowns and auto-select columns
        populateDropdowns(parsedData.headers);

        // Auto-fill: income → outcome, sex → protected attribute
        if (parsedData.headers.includes("income")) outcomeCol.value = "income";
        if (parsedData.headers.includes("sex")) protectedAttr.value = "sex";
        validateForm();

        showToast(`Demo loaded · ${parsedData.rows.length.toLocaleString()} rows · ${parsedData.headers.length} columns`);
      } catch (err) {
        showToast("⚠ " + err.message);
        console.error("Demo load error:", err);
      } finally {
        tryDemoBtn.disabled = false;
        tryDemoBtn.innerHTML = `
          <span class="btn-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
          </span>
          Try Demo Dataset
          <span class="demo-tag">UCI Adult Income</span>`;
      }
    });
  }

  // ══════════════════════════════════════════════════
  //  CSV PARSER (handles quoted fields, newlines)
  // ══════════════════════════════════════════════════

  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
    if (lines.length < 2) return null;

    const headers = parseCSVLine(lines[0]);
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length !== headers.length) continue; // skip malformed rows
      const row = {};
      headers.forEach((h, idx) => (row[h] = values[idx]));
      rows.push(row);
    }

    // Strip whitespace from ALL string values in every row
    // UCI Adult dataset has leading spaces in many columns (" Male", " Female", " >50K", etc.)
    for (const row of rows) {
      for (const key of Object.keys(row)) {
        if (typeof row[key] === "string") {
          row[key] = row[key].trim();
        }
      }
    }

    // Also strip headers
    const cleanHeaders = headers.map((h) => h.trim());

    console.log(`[FairScan] Parsed ${rows.length} rows, ${cleanHeaders.length} columns`);
    if (rows.length > 0) {
      console.log("[FairScan] Sample row:", JSON.stringify(rows[0]));
    }

    return { headers: cleanHeaders, rows };
  }

  function parseCSVLine(line) {
    const result = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ",") {
          result.push(current.trim());
          current = "";
        } else {
          current += ch;
        }
      }
    }
    result.push(current.trim());
    return result;
  }

  // ── File Handling ──────────────────────────────
  function handleFile(file) {
    if (!file.name.endsWith(".csv")) {
      showToast("Please upload a CSV file.");
      return;
    }

    uploadedFile = file;
    fileName.textContent = file.name;
    fileSize.textContent = formatBytes(file.size);
    fileInfo.classList.remove("hidden");
    dropzone.style.display = "none";
    topbarStatus.textContent = file.name;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      parsedData = parseCSV(text);
      if (parsedData && parsedData.rows.length > 0) {
        populateDropdowns(parsedData.headers);
        showToast(`Parsed ${parsedData.rows.length.toLocaleString()} rows · ${parsedData.headers.length} columns`);
      } else {
        showToast("Could not parse CSV. Please check the format.");
        parsedData = null;
      }
    };
    reader.readAsText(file);
  }

  function populateDropdowns(headers) {
    [outcomeCol, protectedAttr].forEach((sel) => {
      sel.innerHTML =
        '<option value="" disabled selected>Select column…</option>';
      headers.forEach((h) => {
        const opt = document.createElement("option");
        opt.value = h;
        opt.textContent = h;
        sel.appendChild(opt);
      });
      sel.disabled = false;
    });
    validateForm();
  }

  function resetDropdowns() {
    [outcomeCol, protectedAttr].forEach((sel) => {
      sel.innerHTML =
        '<option value="" disabled selected>Upload a file first</option>';
      sel.disabled = true;
    });
    runAuditBtn.disabled = true;
  }

  function validateForm() {
    const outcomeVal = outcomeCol.value;
    const protectedVal = protectedAttr.value;

    // Prevent selecting the same column for both
    if (outcomeVal && protectedVal && outcomeVal === protectedVal) {
      showToast("Outcome and protected attribute must be different columns.");
      runAuditBtn.disabled = true;
      return;
    }

    const hasFile = uploadedFile || demoFileName;
    runAuditBtn.disabled = !(hasFile && outcomeVal && protectedVal);
  }

  outcomeCol.addEventListener("change", validateForm);
  protectedAttr.addEventListener("change", validateForm);

  // ══════════════════════════════════════════════════
  //  AUTO-ENCODING FOR STRING OUTCOME COLUMNS
  // ══════════════════════════════════════════════════

  /**
   * Detect if the outcome column contains string values that need encoding.
   * Uses substring matching for robustness (handles ">50K", ">50K.", " >50K", etc.)
   * Returns { positiveLabel, negativeLabel, useSubstring } or null.
   */
  function detectOutcomeEncoding(data, outcomeColumn) {
    const valueCounts = {};
    for (const row of data.rows) {
      const v = (row[outcomeColumn] ?? "").trim();
      if (v) valueCounts[v] = (valueCounts[v] || 0) + 1;
    }

    const uniqueValues = Object.keys(valueCounts);
    console.log(`[FairScan] Outcome column "${outcomeColumn}" unique values:`, JSON.stringify(valueCounts));

    // Check if all values are already recognized standard labels
    const allRecognized = uniqueValues.every((v) => isKnownOutcomeLabel(v));
    if (allRecognized) {
      console.log("[FairScan] All outcome values are recognized standard labels, no encoding needed.");
      return null;
    }

    // Check if any value contains ">50K" (Adult Income dataset)
    const has50K = uniqueValues.some((v) => v.toUpperCase().includes(">50K"));
    if (has50K) {
      // Explicit Adult Income encoding: >50K = positive, everything else = negative
      const positiveLabel = uniqueValues.find((v) => v.toUpperCase().includes(">50K"));
      const negativeLabel = uniqueValues.find((v) => v !== positiveLabel) || uniqueValues[0];
      console.log(`[FairScan] Adult Income encoding: "${positiveLabel}" → 1 (positive), "${negativeLabel}" → 0 (negative)`);
      console.log(`[FairScan] Positive count: ${valueCounts[positiveLabel]}, Negative count: ${valueCounts[negativeLabel]}`);
      console.log(`[FairScan] Expected positive rate: ${(valueCounts[positiveLabel] / (valueCounts[positiveLabel] + valueCounts[negativeLabel]) * 100).toFixed(1)}%`);
      showToast(`Encoded: "${positiveLabel}" → positive, "${negativeLabel}" → negative`);
      return { positiveLabel, negativeLabel, useSubstring: true, substringMatch: ">50K" };
    }

    // For exactly 2 unique values, encode the less frequent as positive
    if (uniqueValues.length === 2) {
      const sorted = uniqueValues.sort((a, b) => valueCounts[a] - valueCounts[b]);
      const positiveLabel = sorted[0]; // less frequent = positive
      const negativeLabel = sorted[1];
      console.log(`[FairScan] Auto-encoding outcome: "${positiveLabel}" → 1 (positive), "${negativeLabel}" → 0 (negative)`);
      console.log(`[FairScan] Positive count: ${valueCounts[positiveLabel]}, Negative count: ${valueCounts[negativeLabel]}`);
      showToast(`Encoded: "${positiveLabel}" → positive, "${negativeLabel}" → negative`);
      return { positiveLabel, negativeLabel, useSubstring: false };
    }

    // For > 2 unique values, check known ordinal patterns or use fallback
    if (uniqueValues.length > 2) {
      const lowerVals = uniqueValues.map((v) => v.toLowerCase());
      let positiveLabel = null;
      let labelType = "";

      // Pattern 1: Low/Medium/High (COMPAS) -> High = 1
      if (lowerVals.includes("low") && lowerVals.includes("high")) {
        positiveLabel = uniqueValues.find((v) => v.toLowerCase() === "high");
        labelType = "High=1, Low/Medium=0";
      }
      // Pattern 2: Good/Bad (German Credit) -> Bad = 1
      else if (lowerVals.includes("good") && lowerVals.includes("bad")) {
        positiveLabel = uniqueValues.find((v) => v.toLowerCase() === "bad");
        labelType = "Bad=1, Good=0";
      }
      // Pattern 3: Yes/No -> Yes = 1
      else if (lowerVals.includes("yes") && lowerVals.includes("no")) {
        positiveLabel = uniqueValues.find((v) => v.toLowerCase() === "yes");
        labelType = "Yes=1, No=0";
      }
      // Fallback: encode least frequent value as positive outcome
      else {
        const sorted = uniqueValues.sort((a, b) => valueCounts[a] - valueCounts[b]);
        positiveLabel = sorted[0]; // least frequent
        labelType = `Fallback: ${positiveLabel}=1, others=0`;
      }

      console.log(`[FairScan] Encoded ${outcomeColumn}: ${labelType}`);
      showToast(`Encoded: "${positiveLabel}" → positive, others → negative`);
      return { positiveLabel, useSubstring: false };
    }
  }

  /** Check if a value is a known standard outcome label */
  function isKnownOutcomeLabel(value) {
    const v = value.toLowerCase().trim();
    const known = [
      "1", "0", "true", "false", "yes", "no", "y", "n",
      "approved", "denied", "accepted", "rejected",
      "pass", "passed", "fail", "failed",
      "hired", "granted", "admit", "admitted", "selected",
      "not approved", "not selected",
    ];
    if (known.includes(v)) return true;
    const num = parseFloat(v);
    return !isNaN(num) && String(num) === v; // Only match pure numbers, not "<=50K"
  }

  // ══════════════════════════════════════════════════
  //  BIAS AUDIT ENGINE
  // ══════════════════════════════════════════════════

  function runBiasAudit(data, outcomeColumn, protectedColumn) {
    // Auto-detect encoding for string outcome columns
    outcomeEncoding = detectOutcomeEncoding(data, outcomeColumn);

    const groups = {};
    let totalRows = 0;
    let totalPositive = 0;
    let skippedRows = 0;

    for (const row of data.rows) {
      const group = (row[protectedColumn] ?? "").trim();
      const outcome = (row[outcomeColumn] ?? "").trim();

      if (!group || !outcome) {
        skippedRows++;
        continue;
      }

      const isPositive = isPositiveOutcome(outcome, outcomeEncoding);

      if (!groups[group]) {
        groups[group] = { total: 0, positive: 0 };
      }
      groups[group].total++;
      if (isPositive) groups[group].positive++;

      totalRows++;
      if (isPositive) totalPositive++;
    }

    if (totalRows === 0) {
      throw new Error("No valid data rows found. Check your column selections.");
    }

    const groupNames = Object.keys(groups);
    if (groupNames.length < 2) {
      throw new Error(
        `Protected attribute "${protectedColumn}" has only ${groupNames.length} unique value(s). Need at least 2 groups to audit.`
      );
    }

    const groupRates = groupNames.map((name) => ({
      name,
      total: groups[name].total,
      positive: groups[name].positive,
      rate: groups[name].total > 0 ? groups[name].positive / groups[name].total : 0,
    }));

    groupRates.sort((a, b) => b.rate - a.rate);

    const rates = groupRates.map((g) => g.rate);
    const maxRate = Math.max(...rates);
    const minRate = Math.min(...rates);

    const dpd = maxRate - minRate;
    const dir = maxRate > 0 ? minRate / maxRate : 1;

    let pairwiseSum = 0;
    let pairCount = 0;
    for (let i = 0; i < rates.length; i++) {
      for (let j = i + 1; j < rates.length; j++) {
        pairwiseSum += Math.abs(rates[i] - rates[j]);
        pairCount++;
      }
    }
    const eod = pairCount > 0 ? pairwiseSum / pairCount : 0;

    const dpdStatus = dpd <= 0.05 ? "pass" : dpd <= 0.10 ? "warn" : "fail";
    const dirStatus = dir >= 0.80 ? "pass" : dir >= 0.70 ? "warn" : "fail";
    const eodStatus = eod <= 0.05 ? "pass" : eod <= 0.10 ? "warn" : "fail";

    const statuses = [dpdStatus, dirStatus, eodStatus];
    const failCount = statuses.filter((s) => s === "fail").length;
    const warnCount = statuses.filter((s) => s === "warn").length;

    let severity;
    if (failCount >= 2)      severity = "high";
    else if (failCount === 1) severity = "medium";
    else if (warnCount > 0)   severity = "medium";
    else                      severity = "low";

    const bestGroup = groupRates[0];
    const worstGroup = groupRates[groupRates.length - 1];

    return {
      totalRows,
      totalPositive,
      skippedRows,
      overallRate: totalRows > 0 ? totalPositive / totalRows : 0,
      groupRates,
      groupCount: groupNames.length,
      metrics: {
        dpd: { value: dpd, status: dpdStatus },
        dir: { value: dir, status: dirStatus },
        eod: { value: eod, status: eodStatus },
      },
      severity,
      bestGroup,
      worstGroup,
      outcomeColumn,
      protectedColumn,
    };
  }

  /** Determine if a cell value represents a positive / favorable outcome */
  function isPositiveOutcome(value, encoding = null) {
    const v = value.trim();

    // If auto-encoding is active, use it
    if (encoding) {
      // Use substring matching for robustness (handles ">50K", ">50K.", whitespace variants)
      if (encoding.useSubstring && encoding.substringMatch) {
        return v.toUpperCase().includes(encoding.substringMatch);
      }
      // Exact match for non-substring encodings
      return v === encoding.positiveLabel;
    }

    const lower = v.toLowerCase();

    // Explicit positive labels
    if (
      lower === "1" || lower === "true" || lower === "yes" ||
      lower === "approved" || lower === "accepted" || lower === "pass" ||
      lower === "passed" || lower === "hired" || lower === "granted" ||
      lower === "admit" || lower === "admitted" || lower === "selected" || lower === "y"
    ) {
      return true;
    }

    // Explicit negative labels
    if (
      lower === "0" || lower === "false" || lower === "no" ||
      lower === "denied" || lower === "rejected" || lower === "fail" ||
      lower === "failed" || lower === "n" || lower === "not approved" ||
      lower === "not selected"
    ) {
      return false;
    }

    // Fallback: try numeric > 0
    const num = parseFloat(lower);
    if (!isNaN(num)) return num > 0;

    return false;
  }

  // ══════════════════════════════════════════════════
  //  EXPLANATION & RECOMMENDATION GENERATOR (Template)
  // ══════════════════════════════════════════════════

  function generateExplanation(results) {
    const { bestGroup, worstGroup, metrics, protectedColumn, severity, groupRates, groupCount } = results;
    const rateDiffPct = ((bestGroup.rate - worstGroup.rate) * 100).toFixed(1);
    const bestPct = (bestGroup.rate * 100).toFixed(1);
    const worstPct = (worstGroup.rate * 100).toFixed(1);
    const dirVal = metrics.dir.value.toFixed(2);

    const severityAdj =
      severity === "high" ? "statistically significant" :
      severity === "medium" ? "notable" : "minor";

    let text = `The data exhibits <strong>${severityAdj}</strong> disparities in positive outcome rates across <strong>${groupCount}</strong> demographic groups defined by the <strong>"${protectedColumn}"</strong> column. `;

    text += `Specifically, the <strong>"${bestGroup.name}"</strong> group receives favorable outcomes at <strong>${bestPct}%</strong>, while the <strong>"${worstGroup.name}"</strong> group receives them at only <strong>${worstPct}%</strong> — a gap of <strong>${rateDiffPct}&nbsp;percentage&nbsp;points</strong>`;

    if (metrics.dir.status === "fail") {
      text += `. The Disparate Impact Ratio of <strong>${dirVal}</strong> falls below the <strong>0.80</strong> legal threshold (EEOC four-fifths rule), suggesting the model's decisions may disproportionately disadvantage certain protected classes.`;
    } else if (metrics.dir.status === "warn") {
      text += `. The Disparate Impact Ratio of <strong>${dirVal}</strong> is approaching the <strong>0.80</strong> legal threshold, warranting close monitoring and proactive mitigation.`;
    } else {
      text += `. The Disparate Impact Ratio of <strong>${dirVal}</strong> meets the 0.80 legal threshold, though continuous monitoring is recommended.`;
    }

    if (groupCount > 2) {
      const midGroups = groupRates.slice(1, -1);
      const midSummary = midGroups
        .map((g) => `"${g.name}" (${(g.rate * 100).toFixed(1)}%)`)
        .join(", ");
      text += ` Other groups fall between these extremes: ${midSummary}.`;
    }

    return text;
  }

  function generateRecommendations(results) {
    const recs = [];
    const { metrics, severity, protectedColumn } = results;

    if (metrics.dpd.status === "fail" || metrics.dir.status === "fail") {
      recs.push("Apply re-weighting or re-sampling to balance training data across demographic groups before model fitting.");
      recs.push("Introduce a post-processing calibration step (e.g., equalized odds constraint) to adjust decision thresholds per group.");
      recs.push(`Remove or decorrelate proxy features that may be highly correlated with the "${protectedColumn}" attribute (e.g., zip code, institution tier, language).`);
    }

    if (metrics.eod.status !== "pass") {
      recs.push("Analyze feature importance to identify which variables contribute most to inter-group disparities and consider fairness-aware feature selection.");
    }

    if (severity === "high") {
      recs.push("Conduct a comprehensive disparate impact analysis with legal counsel before deploying this model in production.");
      recs.push("Consider implementing algorithmic fairness constraints (e.g., demographic parity, equalized odds) directly into the model training objective.");
    } else if (severity === "medium") {
      recs.push("Establish ongoing monitoring dashboards to track fairness metrics over time and detect demographic drift.");
      recs.push("Perform a causal analysis to distinguish between legitimate factors and proxy discrimination.");
    }

    if (recs.length === 0) {
      recs.push("Continue monitoring fairness metrics periodically to ensure the model maintains equitable outcomes across all groups.");
      recs.push("Document the current fairness assessment as part of the model governance record.");
    }

    return recs;
  }

  // ══════════════════════════════════════════════════
  //  GEMINI API INTEGRATION (via server proxy)
  // ══════════════════════════════════════════════════

  /**
   * Call Gemini via the local server proxy to generate AI explanation & recommendations.
   * The API key is stored server-side in .env — never exposed to the client.
   * Returns { explanation: string, recommendations: string[] } or null on failure.
   */
  async function callGeminiAPI(results) {
    const groupTable = results.groupRates
      .map((g) => `  - "${g.name}": ${g.positive}/${g.total} positive (${(g.rate * 100).toFixed(1)}%)`)
      .join("\n");

    const currentFileName = demoFileName || (uploadedFile ? uploadedFile.name : "dataset");

    const prompt = `You are a fairness auditor explaining bias findings to a non-technical audience (NGO managers, HR teams, startup founders).

Dataset: ${currentFileName}
Outcome column: ${results.outcomeColumn}
Protected attribute: ${results.protectedColumn}
Number of rows: ${results.totalRows.toLocaleString()}

Fairness metrics computed:
- Demographic Parity Difference: ${results.metrics.dpd.value.toFixed(4)} (threshold: ≤0.10, status: ${results.metrics.dpd.status.toUpperCase()})
- Disparate Impact Ratio: ${results.metrics.dir.value.toFixed(4)} (threshold: ≥0.80, status: ${results.metrics.dir.status.toUpperCase()})
- Equalized Odds Difference: ${results.metrics.eod.value.toFixed(4)} (threshold: ≤0.10, status: ${results.metrics.eod.status.toUpperCase()})

Group-level selection rates:
${groupTable}

Write a 3-4 sentence plain English explanation that:
1. Names the specific groups and the exact percentage gap between best and worst treated group
2. Explains what this means in real-world terms (e.g. "a woman with identical qualifications is 3x less likely to be selected")
3. States whether this meets or violates the EEOC four-fifths rule

Then provide exactly 3 recommended fixes that are concrete and actionable, not generic.
Return strictly as JSON with no extra text: {"explanation": "...", "fixes": ["...", "...", "..."]}`;

    try {
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 2048,
          },
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData?.error || response.statusText;
        console.warn("Gemini proxy error:", errMsg);
        showToast(`⚠ AI: ${String(errMsg).substring(0, 80)}`);
        return null;
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        console.warn("Gemini returned empty response");
        return null;
      }

      // Strip markdown code fences if present
      const cleaned = rawText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      const parsed = JSON.parse(cleaned);

      // Normalize: accept both "fixes" and "recommendations" keys
      const recs = parsed.fixes || parsed.recommendations;
      if (parsed.explanation && Array.isArray(recs)) {
        return { explanation: parsed.explanation, recommendations: recs };
      }

      console.warn("Gemini response missing expected fields:", parsed);
      return null;
    } catch (err) {
      console.error("Gemini API call failed:", err);
      showToast("⚠ AI generation failed — using template analysis.");
      return null;
    }
  }

  // ══════════════════════════════════════════════════
  //  UI UPDATE — Populate Dashboard & Report
  // ══════════════════════════════════════════════════

  /**
   * Update all UI panels. If `aiResponse` is provided (from Gemini),
   * use it for explanation & recommendations; otherwise fall back to templates.
   */
  function updateUI(results, aiResponse = null) {
    const { groupRates, metrics, severity, protectedColumn, totalRows } = results;
    const usedAI = !!aiResponse;

    // ── Severity badges ───────────────────────────
    const severityMap = {
      high:   { text: "High Risk",   cls: "badge-red" },
      medium: { text: "Medium Risk", cls: "badge-amber" },
      low:    { text: "Low Risk",    cls: "badge-green" },
    };
    const sev = severityMap[severity];

    ["#severity-badge", "#report-severity-badge"].forEach((id) => {
      const el = $(id);
      el.textContent = sev.text;
      el.className = `badge ${sev.cls}`;
    });

    // ── Explanation ───────────────────────────────
    let explanation;
    if (usedAI) {
      // Gemini returns plain text; sanitize and convert newlines to <br> for display
      explanation = aiResponse.explanation
        .split(/\n\n+/)
        .map((p) => `<p style="margin-bottom:10px">${escapeHTML(p.trim())}</p>`)
        .join("");
    } else {
      explanation = generateExplanation(results);
    }

    // Show AI badge if Gemini was used
    const sectionLabel = $("#summary-panel .section-label");
    if (sectionLabel) {
      sectionLabel.innerHTML = usedAI
        ? 'AI Explanation <span class="ai-badge">✦ Gemini</span>'
        : 'AI Explanation';
    }

    $("#explanation-text").innerHTML = explanation;
    $("#report-explanation").innerHTML = explanation;

    // ── Recommendations ──────────────────────────
    const recs = usedAI ? aiResponse.recommendations : generateRecommendations(results);

    $("#fix-list").innerHTML = recs
      .map(
        (r) => `<li class="fix-item"><span class="fix-bullet"></span><span>${escapeHTML(r)}</span></li>`
      )
      .join("");

    $("#report-remed-list").innerHTML = recs
      .map((r) => `<li>${escapeHTML(r)}</li>`)
      .join("");

    // ── Dashboard Metrics Table ──────────────────
    $("#metrics-table tbody").innerHTML = buildMetricRow(
      "Demographic Parity Difference",
      "|P(Ŷ=1|A=a) − P(Ŷ=1|A=b)|",
      metrics.dpd
    ) + buildMetricRow(
      "Disparate Impact Ratio",
      "min(rate) / max(rate)",
      metrics.dir
    ) + buildMetricRow(
      "Equalized Odds Difference",
      "mean |rate_a − rate_b| across groups",
      metrics.eod
    );

    // ── Report Metrics Table ─────────────────────
    $("#report-metrics-table tbody").innerHTML = buildReportMetricRow(
      "Demographic Parity Difference", metrics.dpd, "≤ 0.10"
    ) + buildReportMetricRow(
      "Disparate Impact Ratio", metrics.dir, "≥ 0.80"
    ) + buildReportMetricRow(
      "Equalized Odds Difference", metrics.eod, "≤ 0.10"
    );

    // ── Chart subtitle ───────────────────────────
    $(".card-meta").textContent = `Protected attribute: ${protectedColumn}`;

    // ── Report metadata ─────────────────────────
    const today = new Date();
    const opts = { year: "numeric", month: "long", day: "numeric" };
    $("#report-date").textContent = today.toLocaleDateString("en-US", opts);
    $("#report-file").textContent = demoFileName || (uploadedFile ? uploadedFile.name : "—");
    $("#report-rows").textContent = totalRows.toLocaleString();
    $("#report-outcome").textContent = results.outcomeColumn;
    $("#report-attr").textContent = results.protectedColumn;

    // ── Unlock nav ───────────────────────────────
    $("#nav-dashboard").classList.remove("nav-locked");
    $("#nav-report").classList.remove("nav-locked");
  }

  /* helper: build a dashboard metric row */
  function buildMetricRow(name, hint, metric) {
    return `<tr>
      <td class="metric-name">
        <span>${name}</span>
        <span class="metric-hint">${hint}</span>
      </td>
      <td class="metric-value">${metric.value.toFixed(2)}</td>
      <td><span class="status-indicator status-${metric.status}">${statusText(metric.status)}</span></td>
    </tr>`;
  }

  /* helper: build a report metric row */
  function buildReportMetricRow(name, metric, threshold) {
    return `<tr>
      <td>${name}</td>
      <td>${metric.value.toFixed(2)}</td>
      <td>${threshold}</td>
      <td><span class="status-indicator status-${metric.status}">${statusText(metric.status)}</span></td>
    </tr>`;
  }

  function statusText(s) {
    return s === "pass" ? "Pass" : s === "warn" ? "Warning" : "Fail";
  }

  // ══════════════════════════════════════════════════
  //  VALIDATION
  // ══════════════════════════════════════════════════

  function validateColumns(data, outcomeColName, protectedColName) {
    const errors = [];
    const outcomeVals = new Set();
    const protectedVals = new Set();
    let outcomeTotalLen = 0;
    let outcomeStringCount = 0;
    let outcomeMissing = 0;
    const totalRows = data.rows.length;

    for (const row of data.rows) {
      const oVal = (row[outcomeColName] ?? "").trim();
      const pVal = (row[protectedColName] ?? "").trim();
      
      if (!oVal) {
        outcomeMissing++;
      } else {
        outcomeVals.add(oVal);
        if (isNaN(Number(oVal))) {
          outcomeTotalLen += oVal.length;
          outcomeStringCount++;
        }
      }
      
      if (pVal) {
        protectedVals.add(pVal);
      }
    }

    if (outcomeVals.size > 10) {
      errors.push(`Outcome column '${outcomeColName}' has ${outcomeVals.size} unique values. Please select a binary column (e.g. approved/rejected, yes/no, 0/1).`);
    }

    if (outcomeStringCount > 0) {
      const avgLen = outcomeTotalLen / outcomeStringCount;
      if (avgLen > 20) {
        errors.push(`Outcome column '${outcomeColName}' looks like a text/name column, not a decision outcome.`);
      }
    }

    if (protectedVals.size > 20) {
      errors.push(`Protected attribute '${protectedColName}' has ${protectedVals.size} unique groups — too many to analyze meaningfully. Try a column with fewer categories.`);
    }

    if (protectedVals.size < 2) {
      errors.push(`Protected attribute '${protectedColName}' has only 1 unique value — cannot compare groups.`);
    }

    if (outcomeMissing > totalRows * 0.3) {
      const percent = Math.round((outcomeMissing / totalRows) * 100);
      errors.push(`Outcome column '${outcomeColName}' has ${outcomeMissing} missing values (${percent}%). Too much missing data to audit reliably.`);
    }

    return errors;
  }

  function showValidationErrorCard(errors) {
    const errorCard = document.getElementById("validation-error-card");
    const errorList = document.getElementById("validation-error-list");
    const dashboardContent = document.getElementById("dashboard-content");
    
    if (dashboardContent) dashboardContent.classList.add("hidden");
    if (errorCard) errorCard.classList.remove("hidden");
    
    switchScreen("dashboard");

    errorList.innerHTML = "";
    errors.forEach((err) => {
      const li = document.createElement("li");
      li.textContent = err;
      errorList.appendChild(li);
    });
  }

  // ══════════════════════════════════════════════════
  //  RUN AUDIT
  // ══════════════════════════════════════════════════

  runAuditBtn.addEventListener("click", async () => {
    if (runAuditBtn.disabled || !parsedData) return;

    // Validate column selection
    if (outcomeCol.value === protectedAttr.value) {
      showToast("Outcome and protected attribute must be different columns.");
      return;
    }

    const validationErrors = validateColumns(parsedData, outcomeCol.value, protectedAttr.value);
    if (validationErrors.length > 0) {
      showValidationErrorCard(validationErrors);
      return;
    }

    // Hide error card if previously shown
    const errorCard = document.getElementById("validation-error-card");
    const dashboardContent = document.getElementById("dashboard-content");
    if (errorCard) errorCard.classList.add("hidden");
    if (dashboardContent) dashboardContent.classList.remove("hidden");

    loadingOverlay.classList.remove("hidden");
    $(".loading-text").textContent = "Running bias audit…";
    $(".loading-hint").textContent = "Analyzing demographic disparities";

    // Short delay to let loading UI render
    await new Promise((r) => setTimeout(r, 200));

    try {
      // 1. Compute metrics (synchronous)
      auditResults = runBiasAudit(parsedData, outcomeCol.value, protectedAttr.value);

      // 2. Call Gemini API via server proxy
      let aiResponse = null;

      $(".loading-text").textContent = "Generating AI insights…";
      $(".loading-hint").textContent = "Querying Gemini for expert analysis";

      aiResponse = await callGeminiAPI(auditResults);

      if (aiResponse) {
        showToast("✦ AI insights generated by Gemini");
      }

      // 3. Update the UI with metrics + optional AI response
      updateUI(auditResults, aiResponse);
      loadingOverlay.classList.add("hidden");

      const skipMsg = auditResults.skippedRows > 0
        ? ` (${auditResults.skippedRows} rows skipped — missing data)`
        : "";
      const aiMsg = aiResponse ? " · ✦ AI" : "";
      showToast(`Audit complete · ${auditResults.totalRows.toLocaleString()} rows · ${auditResults.groupCount} groups${skipMsg}${aiMsg}`);

      switchScreen("dashboard");
    } catch (err) {
      loadingOverlay.classList.add("hidden");
      showToast("⚠ " + err.message);
      console.error("FairScan audit error:", err);
    }
  });

  // ══════════════════════════════════════════════════
  //  CHART (dynamic)
  // ══════════════════════════════════════════════════

  function renderChart(results) {
    if (!results) return;
    const canvas = $("#bar-chart");
    if (!canvas) return;

    if (chartInstance) chartInstance.destroy();

    const { groupRates } = results;
    const minRate = groupRates[groupRates.length - 1].rate;

    // Color: green for most groups, amber for the lowest-rate group to highlight disparity
    const palette = groupRates.map((g) => {
      const isWorst = g.rate === minRate && groupRates.length > 1;
      if (isWorst) return { bg: "rgba(217, 119, 6, 0.60)", border: "rgba(217, 119, 6, 1)" };
      return { bg: "rgba(22, 101, 52, 0.70)", border: "rgba(22, 101, 52, 1)" };
    });

    // Custom plugin to render percentage labels at the end of each bar
    const barLabelPlugin = {
      id: "barLabels",
      afterDatasetsDraw(chart) {
        const { ctx } = chart;
        const dataset = chart.data.datasets[0];
        const meta = chart.getDatasetMeta(0);

        meta.data.forEach((bar, i) => {
          const value = dataset.data[i];
          ctx.save();
          ctx.font = "600 12px 'Inter', sans-serif";
          ctx.fillStyle = "#1A1A1A";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          const x = bar.x + 8;
          const y = bar.y;
          ctx.fillText(value + "%", x, y);
          ctx.restore();
        });
      },
    };

    const ctx = canvas.getContext("2d");
    chartInstance = new Chart(ctx, {
      type: "bar",
      plugins: [barLabelPlugin],
      data: {
        labels: groupRates.map((g) => g.name),
        datasets: [
          {
            label: "Positive Outcome Rate (%)",
            data: groupRates.map((g) => +(g.rate * 100).toFixed(1)),
            backgroundColor: palette.map((c) => c.bg),
            borderColor: palette.map((c) => c.border),
            borderWidth: 1,
            borderRadius: 4,
            maxBarThickness: 56,
            minBarLength: 2,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { right: 50 } },
        scales: {
          x: {
            beginAtZero: true,
            max: 100,
            grid: { color: "rgba(0,0,0,0.04)", drawBorder: false },
            ticks: {
              font: { family: "'Inter', sans-serif", size: 12 },
              color: "#9B9B9B",
              callback: (v) => v + "%",
            },
          },
          y: {
            grid: { display: false, drawBorder: false },
            ticks: {
              font: { family: "'Inter', sans-serif", size: 13, weight: "500" },
              color: "#1A1A1A",
            },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#1A1A1A",
            titleFont: { family: "'Inter', sans-serif", size: 13, weight: "600" },
            bodyFont: { family: "'Inter', sans-serif", size: 12 },
            padding: 10,
            cornerRadius: 6,
            callbacks: {
              label: (tipCtx) => {
                const g = groupRates[tipCtx.dataIndex];
                return ` ${tipCtx.parsed.x}%  (${g.positive.toLocaleString()} / ${g.total.toLocaleString()})`;
              },
            },
          },
        },
        animation: { duration: 600, easing: "easeOutQuart" },
      },
    });
  }

  // ══════════════════════════════════════════════════
  //  DOWNLOAD PDF (jsPDF + html2canvas)
  // ══════════════════════════════════════════════════

  downloadPdf.addEventListener("click", async () => {
    if (!auditResults) {
      showToast("Run an audit first to generate a report.");
      return;
    }

    // Check that libraries loaded
    if (typeof html2canvas === "undefined" || typeof jspdf === "undefined") {
      showToast("⚠ PDF libraries not loaded. Please check your internet connection.");
      return;
    }

    const reportEl = document.getElementById("report-card");
    if (!reportEl) {
      showToast("⚠ Report element not found.");
      return;
    }

    // Show generating state
    const originalText = downloadPdf.innerHTML;
    downloadPdf.disabled = true;
    downloadPdf.innerHTML = `
      <span class="btn-icon"><div class="spinner" style="width:16px;height:16px;border-width:2px;margin:0"></div></span>
      Generating PDF…`;
    // Hide button before capture so it doesn't appear in PDF
    downloadPdf.style.visibility = "hidden";

    try {
      const canvas = await html2canvas(reportEl, {
        scale: 3,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false
      });

      const imgData = canvas.toDataURL("image/jpeg", 1.0);
      const { jsPDF } = jspdf;
      const pdf = new jsPDF("p", "mm", "a4");

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      // First page
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      // Additional pages only if content actually overflows
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save("FairScan_Bias_Report.pdf");
      showToast("✓ PDF report downloaded successfully.");
    } catch (err) {
      console.error("PDF generation failed:", err);
      showToast("⚠ Failed to generate PDF.");
    } finally {
      // Always restore button visibility and state
      downloadPdf.style.visibility = "visible";
      downloadPdf.innerHTML = originalText;
      downloadPdf.disabled = false;
    }
  });

  // ══════════════════════════════════════════════════
  //  HELPERS
  // ══════════════════════════════════════════════════

  function formatBytes(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  function escapeHTML(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
