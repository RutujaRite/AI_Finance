module.exports = [
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/action-async-storage.external.js [external] (next/dist/server/app-render/action-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/action-async-storage.external.js", () => require("next/dist/server/app-render/action-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/runtime-reacts.external.js [external] (next/dist/server/runtime-reacts.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/runtime-reacts.external.js", () => require("next/dist/server/runtime-reacts.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/node:stream [external] (node:stream, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("node:stream", () => require("node:stream"));

module.exports = mod;
}),
"[project]/src/app/api/ai-chat/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$data$2f$mockData$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/data/mockData.ts [app-route] (ecmascript)");
;
;
async function POST(request) {
    try {
        const { query } = await request.json();
        if (!query) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: 'Query is required'
            }, {
                status: 400
            });
        }
        const lowerQuery = query.toLowerCase();
        // 1. EMI calculation check (e.g., "5L home loan at 9.5%" or similar)
        if (lowerQuery.includes('emi') || lowerQuery.includes('calculate') || lowerQuery.includes('loan at')) {
            // Extract numbers or use default calculation
            let principal = 500000;
            let rate = 8.5;
            let tenureYears = 5;
            const lakhMatch = lowerQuery.match(/(\d+(\.\d+)?)\s*(l|lakh|lac)/);
            if (lakhMatch) {
                principal = parseFloat(lakhMatch[1]) * 100000;
            } else {
                const rawNumMatch = lowerQuery.match(/(?:rs\.?|₹)?\s*([0-9,]+)/);
                if (rawNumMatch) {
                    const cleanNum = parseInt(rawNumMatch[1].replace(/,/g, ''), 10);
                    if (cleanNum > 10000) principal = cleanNum;
                }
            }
            const rateMatch = lowerQuery.match(/(\d+(\.\d+)?)\s*%/);
            if (rateMatch) {
                rate = parseFloat(rateMatch[1]);
            }
            const months = tenureYears * 12;
            const monthlyRate = rate / (12 * 100);
            const emi = Math.round(principal * monthlyRate * Math.pow(1 + monthlyRate, months) / (Math.pow(1 + monthlyRate, months) - 1));
            const totalPayable = emi * months;
            const totalInterest = totalPayable - principal;
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                response: `Based on your request: For a loan of ₹${principal.toLocaleString('en-IN')} at ${rate}% interest rate over ${tenureYears} years (${months} months), your estimated monthly EMI is ₹${emi.toLocaleString('en-IN')}.\n\n• Principal: ₹${principal.toLocaleString('en-IN')}\n• Total Interest: ₹${totalInterest.toLocaleString('en-IN')}\n• Total Amount: ₹${totalPayable.toLocaleString('en-IN')}`,
                calculatedEmi: {
                    monthlyEmi: emi,
                    principal,
                    interest: totalInterest,
                    tenureMonths: months
                }
            });
        }
        // 2. Manager query check
        if (lowerQuery.includes('manager') || lowerQuery.includes('contact') || lowerQuery.includes('officer')) {
            let matched = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$data$2f$mockData$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["BANK_MANAGERS"];
            if (lowerQuery.includes('pune')) {
                matched = matched.filter((m)=>m.city.toLowerCase() === 'pune');
            } else if (lowerQuery.includes('mumbai')) {
                matched = matched.filter((m)=>m.city.toLowerCase() === 'mumbai');
            } else if (lowerQuery.includes('delhi')) {
                matched = matched.filter((m)=>m.city.toLowerCase().includes('delhi'));
            }
            if (lowerQuery.includes('icici')) {
                matched = matched.filter((m)=>m.bank.toLowerCase().includes('icici'));
            } else if (lowerQuery.includes('hdfc')) {
                matched = matched.filter((m)=>m.bank.toLowerCase().includes('hdfc'));
            } else if (lowerQuery.includes('sbi')) {
                matched = matched.filter((m)=>m.bank.toLowerCase().includes('sbi'));
            }
            if (matched.length > 0) {
                const mgr = matched[0];
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    response: `Found verified banking contact:\n\n• Name: ${mgr.name} (${mgr.role})\n• Institution: ${mgr.bank}, ${mgr.branch}\n• Location: ${mgr.city}\n• Phone: ${mgr.phone}\n• Email: ${mgr.email}\n\nStatus: Verified & available for active underwriting cases.`
                });
            }
        }
        // 3. Bank Policy / Underwriting check
        if (lowerQuery.includes('policy') || lowerQuery.includes('cibil') || lowerQuery.includes('foir') || lowerQuery.includes('fees') || lowerQuery.includes('processing')) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                response: `Live Underwriting Policies Summary:\n\n• HDFC Bank: Min CIBIL 720, FOIR max 65%, Min salary ₹30k/mo. Processing fee: 0.50%.\n• ICICI Bank: Min CIBIL 700, FOIR max 60%, Min salary ₹25k/mo. Instant digital approval available.\n• SBI: Min CIBIL 680, FOIR max 65%, Nil to 0.35% processing fee with 5 bps concession for women.\n• Axis Bank: Min CIBIL 710, FOIR max 60%, Shubh Aarambh 12 EMI waiver benefit.`
            });
        }
        // Default friendly assistant response
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            response: `I've analyzed your query regarding "${query}". Our engine monitors real-time policies across 20+ partner banks (HDFC, ICICI, SBI, Axis), 339K+ corporate listings, and instant loan amortization math. You can ask me to calculate any EMI, check CIBIL & FOIR eligibility cutoffs, or retrieve verified loan branch manager contact details!`
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Internal Server Error';
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: message
        }, {
            status: 500
        });
    }
}
}),
"[project]/src/data/mockData.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "BANK_MANAGERS",
    ()=>BANK_MANAGERS,
    "BANK_POLICIES",
    ()=>BANK_POLICIES,
    "INITIAL_AI_CHAT",
    ()=>INITIAL_AI_CHAT,
    "STATS_DATA",
    ()=>STATS_DATA
]);
const STATS_DATA = [
    {
        id: 'stat-banks',
        number: '20+ Banks',
        label: 'Underwriting Integrations',
        sublabel: 'HDFC, ICICI, SBI, Axis & more',
        icon: 'Building2',
        badge: 'Live API',
        trend: '+3 this month'
    },
    {
        id: 'stat-employers',
        number: '339K+',
        label: 'Employer Category Listings',
        sublabel: 'CAT-A, Super CAT-A, CAT-B, & Govt',
        icon: 'BarChart3',
        badge: 'Updated Today',
        trend: '99.8% accurate'
    },
    {
        id: 'stat-policies',
        number: 'Live Policies',
        label: 'Underwriting Guidelines',
        sublabel: 'CIBIL, FOIR, Age & Salary rules',
        icon: 'FileCheck2',
        badge: 'Verified',
        trend: 'Auto-synced'
    },
    {
        id: 'stat-math',
        number: 'Instant Math',
        label: 'Financial Algorithms',
        sublabel: 'Real-time amortization schedule',
        icon: 'Zap',
        badge: '< 50ms',
        trend: 'Precision grade'
    }
];
const BANK_POLICIES = [
    {
        id: 'hdfc',
        bankName: 'HDFC Bank',
        code: 'HDFC',
        logoColor: '#004c8f',
        minCibil: 720,
        maxFoir: 65,
        minSalary: 30000,
        roiRange: '8.45% - 9.80%',
        processingFee: '0.50% (Max ₹10,000)',
        employerCategories: [
            'Super CAT-A',
            'CAT-A',
            'CAT-B',
            'Listed MNC'
        ],
        maxTenureYears: 30,
        specialRules: [
            'Allows step-up EMI for young professionals under 35',
            'No prepayment penalty on floating rate loans',
            'Bonus and rental income considered at 60% realization'
        ]
    },
    {
        id: 'icici',
        bankName: 'ICICI Bank',
        code: 'ICICI',
        logoColor: '#b02a30',
        minCibil: 700,
        maxFoir: 60,
        minSalary: 25000,
        roiRange: '8.60% - 10.15%',
        processingFee: '0.50% - 1.0%',
        employerCategories: [
            'Elite',
            'CAT-A',
            'CAT-B',
            'Unlisted Corp'
        ],
        maxTenureYears: 30,
        specialRules: [
            'Instant digital sanction letter in 15 minutes with NetBanking',
            'Overdraft loan facility available against property',
            'Co-applicant mandatory if applicant age is > 55 at tenure end'
        ]
    },
    {
        id: 'sbi',
        bankName: 'State Bank of India',
        code: 'SBI',
        logoColor: '#1d71b8',
        minCibil: 680,
        maxFoir: 65,
        minSalary: 25000,
        roiRange: '8.40% - 9.25%',
        processingFee: 'Nil to 0.35% (Special campaign)',
        employerCategories: [
            'Central Govt',
            'State Govt',
            'Defence',
            'CAT-A',
            'CAT-B'
        ],
        maxTenureYears: 30,
        specialRules: [
            'Lowest processing fees and concession for women borrowers (5 bps)',
            'Yuva Home Loan with 20% higher eligibility for applicants up to 45 years',
            'Max age at loan maturity: 70 years'
        ]
    },
    {
        id: 'axis',
        bankName: 'Axis Bank',
        code: 'AXIS',
        logoColor: '#861f41',
        minCibil: 710,
        maxFoir: 60,
        minSalary: 28000,
        roiRange: '8.75% - 10.40%',
        processingFee: '1.0% (Min ₹10,000)',
        employerCategories: [
            'Tier-1 Tech',
            'CAT-A',
            'CAT-B',
            'Self-Employed Prof'
        ],
        maxTenureYears: 30,
        specialRules: [
            'Shubh Aarambh loan with 12 EMIs waived on regular repayment',
            'Fast-track approval for pre-approved developer projects',
            'FOIR stretchable up to 70% for net salaries above ₹1.5 Lakh/month'
        ]
    },
    {
        id: 'kotak',
        bankName: 'Kotak Mahindra Bank',
        code: 'KOTAK',
        logoColor: '#ed1c24',
        minCibil: 730,
        maxFoir: 65,
        minSalary: 35000,
        roiRange: '8.55% - 9.90%',
        processingFee: '0.50% + GST',
        employerCategories: [
            'Tier-1 Corporates',
            'CAT-A',
            'Doctors/CAs'
        ],
        maxTenureYears: 25,
        specialRules: [
            'Preferential pricing for salary accounts maintained with Kotak',
            'Flexi-EMI options with bullet repayment support',
            'Balance transfer top-up up to 100% of original loan amount'
        ]
    }
];
const BANK_MANAGERS = [
    {
        id: 'mgr-1',
        name: 'Rajesh Sharma',
        role: 'Chief Credit Officer & Loan Manager',
        bank: 'ICICI Bank',
        city: 'Pune',
        branch: 'Shivajinagar Commercial Branch',
        phone: '+91 98230 44120',
        email: 'rajesh.sharma@icicibank.example.com',
        verified: true,
        avatar: 'RS'
    },
    {
        id: 'mgr-2',
        name: 'Priya Iyer',
        role: 'AVP - Retail Mortgage & Asset Lending',
        bank: 'HDFC Bank',
        city: 'Mumbai',
        branch: 'Bandra-Kurla Complex (BKC)',
        phone: '+91 99301 88204',
        email: 'priya.iyer@hdfcbank.example.com',
        verified: true,
        avatar: 'PI'
    },
    {
        id: 'mgr-3',
        name: 'Vikramaditya Verma',
        role: 'Branch Manager - SME & Retail Credit',
        bank: 'State Bank of India',
        city: 'Delhi NCR',
        branch: 'Connaught Place Central Hub',
        phone: '+91 98110 57321',
        email: 'vikram.verma@sbi.example.com',
        verified: true,
        avatar: 'VV'
    },
    {
        id: 'mgr-4',
        name: 'Ananya Deshmukh',
        role: 'Regional Credit Head - Personal & Home Loans',
        bank: 'Axis Bank',
        city: 'Pune',
        branch: 'Kothrud Regional Office',
        phone: '+91 97654 32918',
        email: 'ananya.deshmukh@axisbank.example.com',
        verified: true,
        avatar: 'AD'
    },
    {
        id: 'mgr-5',
        name: 'Karthik Sundaram',
        role: 'Senior Loan Underwriting Lead',
        bank: 'Kotak Mahindra Bank',
        city: 'Bengaluru',
        branch: 'Indiranagar Prime Branch',
        phone: '+91 98450 19283',
        email: 'karthik.s@kotak.example.com',
        verified: true,
        avatar: 'KS'
    },
    {
        id: 'mgr-6',
        name: 'Neha Kapoor',
        role: 'Retail Lending Specialist',
        bank: 'HDFC Bank',
        city: 'Hyderabad',
        branch: 'Hitec City Corporate Park',
        phone: '+91 98860 77152',
        email: 'neha.kapoor@hdfcbank.example.com',
        verified: true,
        avatar: 'NK'
    }
];
const INITIAL_AI_CHAT = [
    {
        query: 'Calculate EMI for 5L home loan at 9.5%',
        response: 'Here is the instant calculation for a ₹5,00,000 loan at 9.5% per annum for a tenure of 5 years (60 months). Monthly EMI is ₹10,501. Total interest payable over the loan term is ₹1,30,050.',
        emiDetails: {
            monthlyEmi: 10501,
            principal: 500000,
            interest: 130050,
            tenureMonths: 60
        }
    },
    {
        query: 'Loan processing fees & charges',
        response: 'Across our integrated banking network:\n• SBI: 0.35% (Special promotional offers frequently waive fees)\n• HDFC Bank: 0.50% (Max ₹10,000 + GST)\n• ICICI Bank: 0.50% - 1.00% depending on employer tier rating\n• Axis Bank: 1.00% flat (Min ₹10,000)\n\nNote: All processing charges are subject to applicable GST (18%).'
    },
    {
        query: 'Find ICICI manager details in Pune',
        response: 'Found verified contact:\n• Rajesh Sharma - Chief Credit Officer & Loan Manager\n• Branch: ICICI Bank, Shivajinagar Commercial Branch, Pune\n• Direct Phone: +91 98230 44120\n• Official Email: rajesh.sharma@icicibank.example.com\n\nVerified Status: Active & accepting DSA / applicant direct requests.'
    }
];
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__214asu8._.js.map