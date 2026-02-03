
import React from 'react';
import { cn } from '../../utils/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
        const variants = {
            primary: 'bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white shadow-sm border border-transparent',
            secondary: 'bg-[var(--bg-tertiary)] hover:bg-[var(--border-primary)] text-[var(--text-primary)] border border-[var(--border-primary)]',
            danger: 'bg-[var(--danger-color)] hover:opacity-90 text-white border border-transparent',
            ghost: 'bg-transparent hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-accent)]',
            outline: 'bg-transparent border border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--text-primary)] hover:text-[var(--text-accent)]',
        };

        const sizes = {
            xs: 'h-6 px-1.5 text-[10px]',
            sm: 'h-7 px-2 text-xs',
            md: 'h-8 px-3 text-sm',
            lg: 'h-10 px-4 text-base',
            icon: 'h-8 w-8 p-0 flex items-center justify-center',
        };

        return (
            <button
                ref={ref}
                className={cn(
                    'inline-flex items-center justify-center whitespace-nowrap rounded font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400 disabled:pointer-events-none disabled:opacity-50',
                    variants[variant],
                    sizes[size],
                    className
                )}
                {...props}
            />
        );
    }
);
Button.displayName = 'Button';

export { Button };
