const Header = ({
  variant,
  title,
}: {
  variant: "dashboard" | "public";
  title?: string;
}) => {
  return variant === "public" ? (
    <header className="public-header">
        <h1>{title}</h1>
    </header>
  ) : (
    <header className="dashboard-header">
        <h1>{title}</h1>
    </header>
  );
};

export default Header;
