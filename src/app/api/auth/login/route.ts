import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Determine initials
    const namePart = email.split('@')[0] || 'User';
    const cleanName = namePart.charAt(0).toUpperCase() + namePart.slice(1);

    const user = {
      id: 'usr_' + Math.random().toString(36).substr(2, 9),
      name: cleanName === 'Admin' ? 'Admin Officer' : cleanName,
      email,
      role: email.includes('admin') ? 'Loan Officer' : 'DSA Agent',
      avatarInitials: cleanName.substring(0, 2).toUpperCase(),
      company: 'Premier Banking Network',
      token: 'jwt_mock_' + Buffer.from(email).toString('base64')
    };

    return NextResponse.json({
      success: true,
      message: 'Authentication successful',
      user
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
