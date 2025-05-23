const Header = ({
  variant,
  title,
}: {
  variant: "dashboard" | "public";
  title?: string;
}) => {
  return (
    <header
      className={variant === "public" ? "public-header" : "dashboard-header"}
    >
      <h1>{title}</h1>
    </header>
  );
};

export default Header;
