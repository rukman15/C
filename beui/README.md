# beUI (free library)

Source files of the free, MIT-licensed beUI components, copied from
[starc007/ui-components](https://github.com/starc007/ui-components) (the code behind https://beui.dev).

- `registry.json`: index of all 157 free items (119 components, 38 blocks), with the
  files and npm packages each one needs.
- `components/`: component and block sources (`components/motion`, `components/charts`, ...).
- `lib/`: shared helpers the components import (`utils.ts`, `ease.ts`, `i18n.tsx`, ...).
- `LICENSE`: the original MIT license.

Only files referenced by the public registry are included; beUI Pro is not.

## Using a component

Look up the item in `registry.json`, copy its `files` into your project at the
`target` paths (`@components/...`, `@lib/...`), and install its `dependencies`.

The packages used across the library are: `motion`, `clsx`, `tailwind-merge`,
`lucide-react`, `@floating-ui/dom`, `@tanstack/react-virtual`, `lenis`,
`next-themes`, `shiki`, `@paper-design/shaders-react`. Components are styled with Tailwind CSS.

Or install straight from the registry with the shadcn CLI:

```
npx shadcn@latest add https://beui.dev/r/arc-picker.json
```

## MCP

beUI has a free MCP server at `https://mcp.beui.dev/mcp` (Streamable HTTP),
which can be added as a custom connector in Claude.
