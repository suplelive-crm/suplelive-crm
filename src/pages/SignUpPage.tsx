import { Link } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { SignUpForm } from '@/components/auth/SignUpForm';

export function SignUpPage() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full h-full flex items-center justify-center">
        <AuthLayout
          title="Create Account"
          description="Get started with your CRM dashboard"
        >
          <SignUpForm />
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-600 hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </AuthLayout>
      </div>
    </div>
  );
}