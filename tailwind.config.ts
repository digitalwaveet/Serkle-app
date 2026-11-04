import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))',
					light: 'hsl(var(--primary-light))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				tertiary: {
					DEFAULT: 'hsl(var(--tertiary))',
					foreground: 'hsl(var(--tertiary-foreground))'
				},
				success: {
					DEFAULT: 'hsl(var(--success))',
					foreground: 'hsl(var(--success-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				gray: {
					50: 'hsl(var(--gray-50))',
					100: 'hsl(var(--gray-100))',
					200: 'hsl(var(--gray-200))',
					300: 'hsl(var(--gray-300))',
					400: 'hsl(var(--gray-400))',
					500: 'hsl(var(--gray-500))',
					600: 'hsl(var(--gray-600))',
					700: 'hsl(var(--gray-700))',
					800: 'hsl(var(--gray-800))',
					900: 'hsl(var(--gray-900))'
				}
			},
			backgroundImage: {
				'gradient-primary': 'var(--gradient-primary)',
				'gradient-secondary': 'var(--gradient-secondary)',
				'gradient-hero': 'var(--gradient-hero)'
			},
			boxShadow: {
				elegant: 'var(--shadow-elegant)',
				glow: 'var(--shadow-glow)',
				soft: 'var(--shadow-soft)'
			},
			transitionTimingFunction: {
				smooth: 'var(--transition-smooth)',
				bounce: 'var(--transition-bounce)'
			},
			fontFamily: {
				sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif']
			},
			fontSize: {
				'post-title': 'var(--post-title-size)',
				'post-content': 'var(--post-content-size)', 
				'comment-text': 'var(--comment-text-size)',
				'comment-compact': 'var(--comment-text-compact)',
				'username': 'var(--username-size)',
				'timestamp': 'var(--timestamp-size)',
				'action-label': 'var(--action-label-size)',
				'badge': 'var(--badge-size)',
				'meta-info': 'var(--meta-info-size)',
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				'fade-in': {
					'0%': {
						opacity: '0',
						transform: 'translateY(10px)'
					},
					'100%': {
						opacity: '1',
						transform: 'translateY(0)'
					}
				},
				'scale-in': {
					'0%': {
						transform: 'scale(0.95)',
						opacity: '0'
					},
					'100%': {
						transform: 'scale(1)',
						opacity: '1'
					}
				},
				'slide-up': {
					'0%': {
						transform: 'translateY(100%)',
						opacity: '0'
					},
					'100%': {
						transform: 'translateY(0)',
						opacity: '1'
					}
				},
				'swipe-up': {
					'0%': {
						transform: 'translateY(20px)',
						opacity: '0'
					},
					'100%': {
						transform: 'translateY(0)',
						opacity: '1'
					}
				},
				'bounce-in': {
					'0%': {
						transform: 'scale(0.3)',
						opacity: '0'
					},
					'50%': {
						transform: 'scale(1.05)',
						opacity: '0.8'
					},
					'100%': {
						transform: 'scale(1)',
						opacity: '1'
					}
				},
				'double-tap-heart': {
					'0%': {
						transform: 'scale(0)',
						opacity: '0.8'
					},
					'15%': {
						transform: 'scale(1.3)',
						opacity: '1'
					},
					'30%': {
						transform: 'scale(0.95)',
						opacity: '1'
					},
					'50%': {
						transform: 'scale(1.05)',
						opacity: '1'
					},
					'80%': {
						transform: 'scale(1)',
						opacity: '0.6'
					},
					'100%': {
						transform: 'scale(0.8) translateY(-40px)',
						opacity: '0'
					}
				},
				'color-reveal': {
					'0%': {
						filter: 'grayscale(100%) brightness(0.7)',
						transform: 'scale(0.95)'
					},
					'100%': {
						filter: 'grayscale(0%) brightness(1)',
						transform: 'scale(1)'
					}
				},
				'shake': {
					'0%, 100%': { transform: 'translateX(0)' },
					'20%': { transform: 'translateX(-8px)' },
					'40%': { transform: 'translateX(8px)' },
					'60%': { transform: 'translateX(-5px)' },
					'80%': { transform: 'translateX(5px)' },
				}
			},
			padding: {
				safe: 'env(safe-area-inset-bottom)'
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fade-in': 'fade-in 0.3s ease-out',
				'scale-in': 'scale-in 0.2s ease-out',
				'slide-up': 'slide-up 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
				'swipe-up': 'swipe-up 0.3s ease-out',
				'bounce-in': 'bounce-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
				'double-tap-heart': 'double-tap-heart 0.9s ease-out forwards',
				'color-reveal': 'color-reveal 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards',
				'shake': 'shake 0.35s ease both',
			}
		}
	},
	plugins: [
		require("tailwindcss-animate"),
		function({ addUtilities }: any) {
			const newUtilities = {
				'.hover-scale': {
					'@apply transition-transform duration-200 ease-out hover:scale-105 active:scale-95': {},
				},
				'.scroll-smooth': {
					'scroll-behavior': 'smooth',
				},
				'.scrollbar-thin': {
					'scrollbar-width': 'thin',
					'scrollbar-color': 'hsl(var(--muted-foreground)) transparent',
				},
				'.scrollbar-thin::-webkit-scrollbar': {
					'width': '6px',
				},
				'.scrollbar-thin::-webkit-scrollbar-track': {
					'background': 'transparent',
				},
				'.scrollbar-thin::-webkit-scrollbar-thumb': {
					'background-color': 'hsl(var(--muted-foreground) / 0.3)',
					'border-radius': '3px',
					'&:hover': {
						'background-color': 'hsl(var(--muted-foreground) / 0.5)',
					},
				},
				'.skeleton': {
					'@apply animate-pulse bg-muted rounded-md': {},
				},
				'.skeleton-text': {
					'@apply skeleton h-4 mb-2': {},
				},
				'.skeleton-avatar': {
					'@apply skeleton w-10 h-10 rounded-full': {},
				},
				'.skeleton-card': {
					'@apply skeleton h-32 mb-4': {},
				},
			};
			addUtilities(newUtilities);
		}
	],
} satisfies Config;
