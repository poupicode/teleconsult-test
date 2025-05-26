// Composant pour l'affichage du header de l'application
const Header = ({
  variant,
  title,
}: {
  variant: "dashboard" | "public";
  title?: string;
}) => {
  return (
    // Afficher soit le header pour la page publique (qui prend toute la largeur), soit celui pour le tableau de bord (qui ne prend pas toute la largeur (- side menu))
    <header
      className={variant === "public" ? "public-header" : "dashboard-header"}
    >
      <h1>{title}</h1>
    </header>
  );
};

export default Header;
