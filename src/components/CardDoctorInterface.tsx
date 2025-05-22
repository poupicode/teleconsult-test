export default function CardDoctorInterface() {
  return (
    <div
      className="card shadow-lg p-3 mb-4 rounded"
      style={{ width: "25%", backgroundColor: "#F0EDF4" }}
    >
      <div className="card-body">
        <h5 className="card-title">Salle :</h5>

        <p className="card-text">
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Inventore
          maxime at tenetur sapiente quos perferendis!
        </p>

        <button
          type="button"
          className="btn btn-danger rounded-pill mx-auto d-block mb-3 px-5"
        >
          Rejoindre
        </button>

        <hr className="my-3 border border-primary" />

        <div className="d-flex justify-content-center">
          <button type="button" className="btn btn-link text-danger">
            Supprimer la salle
          </button>
        </div>
      </div>
    </div>
  );
}
