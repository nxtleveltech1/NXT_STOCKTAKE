import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function SettingsLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur-xl">
        <div className="flex items-center gap-2 px-4 py-3 lg:px-6">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/" aria-label="Back to dashboard">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Settings</h1>
        </div>
      </div>
      <main className="p-4 lg:p-6">{children}</main>
    </div>
  )
}
