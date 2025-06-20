// Composant pour l'affichage du header de l'application
const Header = ({
  variant,
  children,
}: {
  variant: "dashboard" | "public" | "consultation";
  children: React.ReactNode;
}) => {
  return (
    // Afficher soit le header pour la page publique (qui prend toute la largeur), soit celui pour le tableau de bord (qui ne prend pas toute la largeur (- side menu))
    <header
      className={`d-flex align-items-center justify-content-between ${variant === "public" ? "public-header" : variant === "dashboard" ? "dashboard-header" : "consultation-header"}`}
      style={{ zIndex: 100, position: "relative" }}
    >
      {children}
    </header>
  );
};

export default Header;
