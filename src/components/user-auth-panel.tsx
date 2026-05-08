"use client";

import { LogIn, ShieldCheck, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthMode = "login" | "register";

type UserAuthPanelProps = {
  email: string;
  error: string | null;
  isSubmitting: boolean;
  mode: AuthMode;
  name: string;
  password: string;
  onFieldChange: (field: "name" | "email" | "password", value: string) => void;
  onModeChange: (mode: AuthMode) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export function UserAuthPanel({
  email,
  error,
  isSubmitting,
  mode,
  name,
  password,
  onFieldChange,
  onModeChange,
  onSubmit,
}: UserAuthPanelProps) {
  const isRegisterMode = mode === "register";

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(119,78,31,0.16),transparent_36%),linear-gradient(180deg,#f7f3ed_0%,#efe6da_45%,#f8f5ef_100%)] px-4 py-10 text-stone-950 sm:px-6 lg:px-10"
    >
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(24rem,0.85fr)] lg:items-center">
        <Card className="border-stone-200/80 bg-white/88 shadow-[0_32px_90px_-48px_rgba(63,40,12,0.48)] backdrop-blur-sm">
          <CardHeader className="space-y-4">
            <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-stone-900 text-stone-50 shadow-[0_18px_40px_-28px_rgba(28,25,23,0.9)]">
              <ShieldCheck className="size-6" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-3xl leading-tight sm:text-4xl">
                احفظ مشاريعك على الحساب بدل المتصفح
              </CardTitle>
              <CardDescription className="max-w-2xl text-sm leading-7 text-stone-600 sm:text-base">
                أنشئ حسابًا أو سجّل الدخول، وسيتم ربط المشاريع والإعدادات باسم
                المستخدم الحالي بدل التخزين المحلي على نفس الجهاز فقط.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm text-stone-600 sm:grid-cols-3">
            <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
              نفس المشروع يظهر بعد الرجوع أو تحديث الصفحة.
            </div>
            <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
              مكتبة المشاريع والإعدادات تصبح مرتبطة بالمستخدم الحالي.
            </div>
            <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
              لا حاجة لاستخدام `localStorage` في الحفظ الرئيسي بعد الآن.
            </div>
          </CardContent>
        </Card>

        <Card className="border-stone-200/80 bg-white/92 shadow-[0_36px_100px_-54px_rgba(63,40,12,0.52)] backdrop-blur-sm">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap gap-2 rounded-2xl border border-stone-200 bg-stone-50/80 p-1.5">
              <Button
                type="button"
                variant={isRegisterMode ? "ghost" : "default"}
                className="min-h-11 flex-1 rounded-xl"
                onClick={() => onModeChange("login")}
              >
                <LogIn className="size-4" />
                تسجيل الدخول
              </Button>
              <Button
                type="button"
                variant={isRegisterMode ? "default" : "ghost"}
                className="min-h-11 flex-1 rounded-xl"
                onClick={() => onModeChange("register")}
              >
                <UserPlus className="size-4" />
                إنشاء حساب
              </Button>
            </div>
            <div>
              <CardTitle>
                {isRegisterMode ? "ابدأ بحساب جديد" : "الدخول إلى حسابك"}
              </CardTitle>
              <CardDescription className="mt-1 text-sm leading-6 text-stone-500">
                {isRegisterMode
                  ? "استخدم اسمًا واضحًا وبريدًا صحيحًا لربط المشاريع بك."
                  : "سجّل الدخول للوصول إلى المشاريع المحفوظة والإعدادات الخاصة بك."}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit}>
              {isRegisterMode ? (
                <div className="space-y-2">
                  <Label htmlFor="authName">اسم المستخدم</Label>
                  <Input
                    id="authName"
                    autoComplete="name"
                    className="h-11 bg-white"
                    value={name}
                    onChange={(event) =>
                      onFieldChange("name", event.target.value)
                    }
                  />
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="authEmail">البريد الإلكتروني</Label>
                <Input
                  id="authEmail"
                  autoComplete="email"
                  className="h-11 bg-white"
                  dir="ltr"
                  inputMode="email"
                  value={email}
                  onChange={(event) =>
                    onFieldChange("email", event.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="authPassword">كلمة المرور</Label>
                <Input
                  id="authPassword"
                  autoComplete={
                    isRegisterMode ? "new-password" : "current-password"
                  }
                  className="h-11 bg-white"
                  dir="ltr"
                  type="password"
                  value={password}
                  onChange={(event) =>
                    onFieldChange("password", event.target.value)
                  }
                />
                <p className="text-xs text-stone-500">
                  الحد الأدنى الحالي 8 أحرف.
                </p>
              </div>

              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <Button
                className="h-11 w-full"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting
                  ? "جارٍ التنفيذ..."
                  : isRegisterMode
                    ? "إنشاء الحساب والدخول"
                    : "تسجيل الدخول"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
