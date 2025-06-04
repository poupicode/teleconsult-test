// components/ButtonConnexionApp.tsx
type ButtonConnexionAppProps = {
  label: string;
  onClick?: () => void;
  className?: string;
  variant?: 'primary' | 'secondary' | 'danger';
};

const variantClasses: Record<NonNullable<ButtonConnexionAppProps['variant']>, string> = {
  primary: 'bg-blue-500 hover:bg-blue-600 text-white',
  secondary: 'bg-gray-500 hover:bg-gray-600 text-white',
  danger: 'bg-red-500 hover:bg-red-600 text-white',
};

function ButtonConnexionApp({ label, onClick, className = '', variant = 'primary' }: ButtonConnexionAppProps) {
  return (
    <button
      onClick={onClick}
      className={`inline-block px-4 py-2 rounded transition ${variantClasses[variant]} ${className}`}
    >
      {label}
    </button>
  );
}

export default ButtonConnexionApp;
