import { useState, useEffect } from 'react';

export function useThemeColor() {
    // Default to a brown color if variable is missing, but try to use CSS variable
    const [themeColor, setThemeColor] = useState('hsl(26 53% 45%)');

    useEffect(() => {
        const updateColor = () => {
            const root = document.documentElement;
            // Get the value of --primary variable
            // Expected format in shadcn: "26 53% 45%" (no hsl wrapper)
            const primaryVar = getComputedStyle(root).getPropertyValue('--primary').trim();

            if (primaryVar) {
                // If it already has hsl(), use it, otherwise wrap it
                const color = primaryVar.startsWith('hsl') ? primaryVar : `hsl(${primaryVar})`;
                setThemeColor(color);
            }
        };

        updateColor();

        // Watch for style changes on the <html> element (where theme colors apply)
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    updateColor();
                }
            }
        });

        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });

        return () => observer.disconnect();
    }, []);

    return themeColor;
}
