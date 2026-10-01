import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password, role, company } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email, and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const initials = name
      .split(' ')
      .map((part: string) => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'US';

    const user = {
      id: 'usr_' + Math.random().toString(36).substr(2, 9),
      name,
      email,
      role: role || 'DSA Agent',
      company: company || 'Financial Advisory Services',
      avatarInitials: initials,
      token: 'jwt_mock_' + Buffer.from(email).toString('base64'),
      createdAt: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      message: 'Account registered successfully',
      user
    }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
