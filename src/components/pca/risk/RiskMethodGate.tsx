import { useState } from "react";
import { RisksInventory, type Risque } from "./RisksInventory";
import { RiskDetailPage } from "./RiskDetailPage";

export const RiskMethodGate = () => {
  const [selected, setSelected] = useState<Risque | null>(null);

  if (selected) {
    return (
      <RiskDetailPage
        risk={selected}
        onBackToInventory={() => setSelected(null)}
      />
    );
  }

  return <RisksInventory onOpenRisk={setSelected} />;
};
