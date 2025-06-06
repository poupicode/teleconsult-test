// Composant pour l'affichage du header de l'application
const Header = ({
  variant,
  children,
}: {
  variant: "dashboard" | "public";
  children: React.ReactNode;
}) => {
  return (
    // Afficher soit le header pour la page publique (qui prend toute la largeur), soit celui pour le tableau de bord (qui ne prend pas toute la largeur (- side menu))
    <header
      className={variant === "public" ? "public-header" : "dashboard-header"}
      style={{ zIndex: 100, position: "relative" }}
    >
      {children}
    </header>
  );
};

export default Header;
