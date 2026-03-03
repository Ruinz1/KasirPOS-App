import { useEffect } from 'react';
import { Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const themes = [
    { name: 'Coffee', primary: '26 53% 45%', ring: '26 53% 45%' },
    { name: 'Ocean', primary: '217 91% 60%', ring: '217 91% 60%' },
    { name: 'Forest', primary: '142 71% 45%', ring: '142 71% 45%' },
    { name: 'Berry', primary: '322 81% 43%', ring: '322 81% 43%' },
    { name: 'Sunset', primary: '24 94% 50%', ring: '24 94% 50%' },
    { name: 'Slate', primary: '222 47% 11%', ring: '222 47% 11%' },
];

export function ThemeToggle() {
    const setTheme = (theme: typeof themes[0]) => {
        document.documentElement.style.setProperty('--primary', theme.primary);
        document.documentElement.style.setProperty('--ring', theme.ring);
        localStorage.setItem('theme_color', JSON.stringify(theme));
    };

    useEffect(() => {
        const saved = localStorage.getItem('theme_color');
        if (saved) {
            try {
                const theme = JSON.parse(saved);
                // Apply style directly
                document.documentElement.style.setProperty('--primary', theme.primary);
                document.documentElement.style.setProperty('--ring', theme.ring);
            } catch (e) {
                console.error('Failed to parse theme', e);
            }
        }
    }, []);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full">
                    <Palette className="w-4 h-4" />
                    <span className="sr-only">Ganti Tema Warna</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {themes.map(t => (
                    <DropdownMenuItem key={t.name} onClick={() => setTheme(t)} className="gap-2 cursor-pointer">
                        <div className="w-4 h-4 rounded-full border border-border" style={{ backgroundColor: `hsl(${t.primary})` }} />
                        {t.name}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
