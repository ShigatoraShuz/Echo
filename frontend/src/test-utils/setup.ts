import { toHaveNoViolations } from "jest-axe";
import "@testing-library/jest-dom";
import { configure } from "@testing-library/react";

configure({ testIdAttribute: "data-testid" });

expect.extend(toHaveNoViolations);
