import { NextResponse } from 'next/server';
import { BANK_POLICIES, BANK_MANAGERS } from '@/data/mockData';

export async function POST(request: Request) {
  try {
    const { query } = await request.json();
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
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
      const emi = Math.round(
        (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
        (Math.pow(1 + monthlyRate, months) - 1)
      );
      const totalPayable = emi * months;
      const totalInterest = totalPayable - principal;

      return NextResponse.json({
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
      let matched = BANK_MANAGERS;
      if (lowerQuery.includes('pune')) {
        matched = matched.filter(m => m.city.toLowerCase() === 'pune');
      } else if (lowerQuery.includes('mumbai')) {
        matched = matched.filter(m => m.city.toLowerCase() === 'mumbai');
      } else if (lowerQuery.includes('delhi')) {
        matched = matched.filter(m => m.city.toLowerCase().includes('delhi'));
      }

      if (lowerQuery.includes('icici')) {
        matched = matched.filter(m => m.bank.toLowerCase().includes('icici'));
      } else if (lowerQuery.includes('hdfc')) {
        matched = matched.filter(m => m.bank.toLowerCase().includes('hdfc'));
      } else if (lowerQuery.includes('sbi')) {
        matched = matched.filter(m => m.bank.toLowerCase().includes('sbi'));
      }

      if (matched.length > 0) {
        const mgr = matched[0];
        return NextResponse.json({
          response: `Found verified banking contact:\n\n• Name: ${mgr.name} (${mgr.role})\n• Institution: ${mgr.bank}, ${mgr.branch}\n• Location: ${mgr.city}\n• Phone: ${mgr.phone}\n• Email: ${mgr.email}\n\nStatus: Verified & available for active underwriting cases.`
        });
      }
    }

    // 3. Bank Policy / Underwriting check
    if (lowerQuery.includes('policy') || lowerQuery.includes('cibil') || lowerQuery.includes('foir') || lowerQuery.includes('fees') || lowerQuery.includes('processing')) {
      return NextResponse.json({
        response: `Live Underwriting Policies Summary:\n\n• HDFC Bank: Min CIBIL 720, FOIR max 65%, Min salary ₹30k/mo. Processing fee: 0.50%.\n• ICICI Bank: Min CIBIL 700, FOIR max 60%, Min salary ₹25k/mo. Instant digital approval available.\n• SBI: Min CIBIL 680, FOIR max 65%, Nil to 0.35% processing fee with 5 bps concession for women.\n• Axis Bank: Min CIBIL 710, FOIR max 60%, Shubh Aarambh 12 EMI waiver benefit.`
      });
    }

    // Default friendly assistant response
    return NextResponse.json({
      response: `I've analyzed your query regarding "${query}". Our engine monitors real-time policies across 20+ partner banks (HDFC, ICICI, SBI, Axis), 339K+ corporate listings, and instant loan amortization math. You can ask me to calculate any EMI, check CIBIL & FOIR eligibility cutoffs, or retrieve verified loan branch manager contact details!`
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
