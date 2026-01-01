import { cn } from "@workspace/ui/lib/utils"
import { Card, CardContent } from "@workspace/ui/components/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { GradientButton } from "@workspace/ui/components/gradient-button"
import { Apple, Facebook } from "lucide-react"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0 transition-colors duration-300 ease-in-out">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form className="p-6 md:p-8">
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold transition-colors duration-300 ease-in-out">Welcome back</h1>
                <p className="text-muted-foreground text-balance transition-colors duration-300 ease-in-out">
                  Login to your Acme Inc account
                </p>
              </div>
              <Field>
                <FieldLabel htmlFor="email" className="transition-colors duration-300 ease-in-out">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  className="transition-colors duration-300 ease-in-out"
                />
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password" className="transition-colors duration-300 ease-in-out">Password</FieldLabel>
                  <a
                    href="#"
                    className="ml-auto text-sm underline-offset-2 hover:underline transition-colors duration-300 ease-in-out"
                  >
                    Forgot your password?
                  </a>
                </div>
                <Input id="password" type="password" required className="transition-colors duration-300 ease-in-out" />
              </Field>
              <Field>
                <GradientButton type="submit" width="full" useThemeGradient glowIntensity="medium">
                  Login
                </GradientButton>
              </Field>
              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card transition-colors duration-300 ease-in-out">
                Or continue with
              </FieldSeparator>
              <Field className="grid grid-cols-3 gap-4">
                <GradientButton variant="outline" type="button" width="full" useThemeGradient glowIntensity="low">
                  <Apple className="size-4" />
                  <span className="sr-only">Login with Apple</span>
                </GradientButton>
                <GradientButton variant="outline" type="button" width="full" useThemeGradient glowIntensity="low">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="size-4">
                    <path
                      d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                      fill="currentColor"
                    />
                  </svg>
                  <span className="sr-only">Login with Google</span>
                </GradientButton>
                <GradientButton variant="outline" type="button" width="full" useThemeGradient glowIntensity="low">
                  <Facebook className="size-4" />
                  <span className="sr-only">Login with Meta</span>
                </GradientButton>
              </Field>
              <FieldDescription className="text-center transition-colors duration-300 ease-in-out">
                Don't have an account? <a href="#" className="transition-colors duration-300 ease-in-out">Sign up</a>
              </FieldDescription>
            </FieldGroup>
          </form>
          <div className="bg-muted relative hidden md:block transition-colors duration-300 ease-in-out">
            <img
              src="/placeholder.svg"
              alt="Image"
              className="absolute inset-0 h-full w-full object-cover transition-all duration-300 ease-in-out dark:brightness-[0.2] dark:grayscale"
            />
          </div>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center transition-colors duration-300 ease-in-out">
        By clicking continue, you agree to our <a href="#" className="transition-colors duration-300 ease-in-out">Terms of Service</a>{" "}
        and <a href="#" className="transition-colors duration-300 ease-in-out">Privacy Policy</a>.
      </FieldDescription>
    </div>
  )
}
