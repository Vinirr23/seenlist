import { FlatCompat } from "@eslint/eslintrc";
import { basePreset } from "@seenlist/config/eslint-preset";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

/** @type {import("eslint").Linter.Config[]} */
const eslintConfig = [...basePreset, ...compat.extends("next/core-web-vitals")];

export default eslintConfig;
