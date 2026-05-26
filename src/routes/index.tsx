import { createFileRoute } from "@tanstack/react-router";
import { Workspace } from "@/components/omni/Workspace";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OmniSocial Studio — Mass Profile Workspace" },
      {
        name: "description",
        content:
          "High-density social media management workspace for orchestrating 100+ profiles with bulk distribution and virtualized grid rendering.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return <Workspace />;
}
