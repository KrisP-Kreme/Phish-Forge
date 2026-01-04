
import { Shield } from "lucide-react";
import Link from "next/link";

const navItems = {
    '/#home': {
        name: 'Home',
    },
    '/#features': {
        name: 'Features',
    },
    '/#how-it-works': {
        name: 'How It Works',
    },
    '/#meet-the-devs': {
        name: 'Meet the Devs',
    }
}
        
export default function Navigation() {
    return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--background)]/80 dark:bg-[var(--background)]/80 backdrop-blur-sm">
        <div className="max-w-1xl mx-auto px-6 py-4 grid grid-cols-3 items-center">
            <div className="flex items-center gap-2">
                <Shield className="w-8 h-8" style={{ color: 'var(--primary)' }} />
                <span className="text-2xl font-bold">
                PhishForge
                </span>
            </div>
            <nav className="flex justify-center space-x-8">
                {Object.entries(navItems).map(([path, { name }]) => (
                <Link
                    key={path}
                    href={path}
                    className="text-[var(--muted-foreground)] cursor-pointer hover:text-[var(--foreground)] hover:scale-105 hover:shadow-lgtransition-colors"
                >
                    {name}
                </Link>
                ))}
            </nav>
            <div />
        </div>
    </header>
    );
}

