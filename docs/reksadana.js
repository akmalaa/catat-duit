import axios from "axios";
import { readFileSync } from "fs";
import { resolve } from "path";

const API_URL =
    "https://pasardana.id/api/FundSearchResult/GetAll?sortField=Name&sortOrder=ASC&type=2&type=3&type=1";

function loadScriptUrl() {
    if (process.env.APPS_SCRIPT_URL?.trim()) {
        return process.env.APPS_SCRIPT_URL.trim();
    }
    try {
        const env = readFileSync(resolve(process.cwd(), ".env"), "utf8");
        const match = env.match(/^VITE_DEFAULT_SCRIPT_URL=(.+)$/m);
        if (match?.[1]?.trim()) return match[1].trim();
    } catch {
        // .env tidak ada — abaikan
    }
    return "";
}

const SCRIPT_URL = loadScriptUrl();

// FUND TYPE:
// 1 = RDS  / Reksadana Saham
// 2 = RDPT / Reksadana Obligasi
// 3 = RDPU / Reksadana Pasar Uang

async function fetchFunds() {
    try {
        const response = await axios.get(API_URL, {
            timeout: 30000,
            headers: {
                Accept: "application/json",
                "User-Agent": "Mozilla/5.0",
            },
            validateStatus: (status) => status < 500,
        });

        if (response.status !== 200) {
            throw new Error(
                `HTTP Error ${response.status}: ${response.statusText}`
            );
        }

        if (!Array.isArray(response.data)) {
            throw new Error("Response bukan array");
        }

        return response.data;

    } catch (err) {
        const networkErrors = {
            ECONNABORTED: "Request timeout",
            ENOTFOUND: "DNS lookup gagal",
            ECONNRESET: "Koneksi diputus server",
        };

        if (networkErrors[err.code]) {
            throw new Error(networkErrors[err.code]);
        }

        throw err;
    }
}

async function fetchWithRetry(retries = 3, delayMs = 2000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await fetchFunds();
        } catch (err) {
            if (attempt === retries) throw err;
            console.warn(
                `[WARN] Attempt ${attempt}/${retries} gagal: ${err.message}. Retry dalam ${delayMs}ms...`
            );
            await new Promise((r) => setTimeout(r, delayMs));
        }
    }
}

function parseDateTime(raw) {
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d.toISOString();
}

function mapFund(item, snapshotDatetime) {
    return {
        fund_id: item.Id ?? null,
        name: item.Name ?? null,
        investment_manager: item.InvestmentManagerName ?? null,
        fund_type: item.Type ?? null,
        sharia: item.Sharia ?? null,
        nab_per_unit: item.NetAssetValue ?? null,
        aum: item.AssetUnderManagement ?? null,
        daily_return: item.DailyReturn ?? null,
        monthly_return: item.MonthlyReturn ?? null,
        yearly_return: item.YearlyReturn ?? null,
        last_update: parseDateTime(item.LastUpdate),
        snapshot_datetime: snapshotDatetime,
    };
}

async function writeToSpreadsheet(funds) {
    if (!SCRIPT_URL) {
        throw new Error(
            "URL Apps Script belum diset. Isi APPS_SCRIPT_URL atau VITE_DEFAULT_SCRIPT_URL di .env"
        );
    }
    if (!SCRIPT_URL.endsWith("/exec")) {
        throw new Error(
            `URL Apps Script harus diakhiri /exec (bukan /exe). URL saat ini: ${SCRIPT_URL}`
        );
    }

    const response = await axios.post(
        SCRIPT_URL,
        { action: "saveReksadana", data: funds },
        {
            timeout: 120000,
            maxRedirects: 5,
            headers: { "Content-Type": "application/json" },
            validateStatus: (status) => status < 500,
        }
    );

    if (response.status !== 200) {
        throw new Error(
            `HTTP Error ${response.status}: ${response.statusText}`
        );
    }

    const result = response.data;
    if (!result?.success) {
        throw new Error(result?.message || "Gagal simpan ke spreadsheet");
    }

    return result;
}

async function main() {
    try {
        const snapshotDatetime = new Date().toISOString();

        console.log(`[${snapshotDatetime}] Start scraping`);

        const data = await fetchWithRetry();

        const validFunds = data
            .filter((item) => Number(item.Id) > 0)
            .map((item) => mapFund(item, snapshotDatetime));

        if (validFunds.length === 0) {
            throw new Error("Tidak ada data fund yang valid");
        }

        console.log(`[INFO] Valid fund: ${validFunds.length}`);

        const result = await writeToSpreadsheet(validFunds);

        console.log(
            `[OK] Spreadsheet berhasil diupdate: sheet List_RD, ${result.data?.count ?? validFunds.length} baris (A4:L)`
        );

    } catch (err) {
        console.error("==================================");
        console.error("SCRAPING GAGAL");
        console.error("Waktu  :", new Date().toISOString());
        console.error("Pesan  :", err.message);
        console.error("==================================");
        process.exit(1);
    }
}

main();
