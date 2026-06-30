import { render, screen } from "@testing-library/react";
import { Providers } from "../../app/Providers";
import { ArtifactViewer } from "./ArtifactViewer";

test("shows artifact content with copy/download actions", async () => {
  render(
    <Providers>
      <ArtifactViewer artifactId="art_code_1" onClose={() => {}} />
    </Providers>,
  );
  expect(await screen.findByText(/import pandas as pd/)).toBeInTheDocument();
  expect(screen.getByText("churn_analysis.py")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Download" })).toBeInTheDocument();
});
