import React from "react";
import { createRoot } from "react-dom/client";
import MiniDrive from "./MiniDrive.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <MiniDrive />
  </React.StrictMode>
);