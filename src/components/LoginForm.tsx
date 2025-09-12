import { useState } from 'react';
import { User } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { UserCircle, Database } from '@phosphor-icons/react';

interface LoginFormProps {
  onLogin: (user: User) => void;
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && email.trim()) {
      onLogin({
        id: email,
        name: name.trim(),
        email: email.trim(),
        isAdmin,
      });
    }
  };

  const handleQuickLogin = (userData: Omit<User, 'id'>) => {
    onLogin({
      id: userData.email,
      ...userData,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-orange-50 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <Database size={48} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Lab Booking System</h1>
          <p className="text-muted-foreground mt-2">
            Sign in to access laboratory servers
          </p>
        </div>

        {/* Login Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCircle size={20} />
              Sign In
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="admin"
                  checked={isAdmin}
                  onCheckedChange={setIsAdmin}
                />
                <Label htmlFor="admin">Admin Access</Label>
              </div>

              <Button type="submit" className="w-full">
                Sign In
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Quick Login Options */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Quick Login (Demo)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => handleQuickLogin({
                name: 'John Engineer',
                email: 'john.engineer@company.com',
                isAdmin: false,
              })}
            >
              👨‍💻 Login as Engineer
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => handleQuickLogin({
                name: 'Sarah Admin',
                email: 'sarah.admin@company.com',
                isAdmin: true,
              })}
            >
              👩‍💼 Login as Admin
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}