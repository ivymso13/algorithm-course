import { WoodcutSandbox } from "@/components/write/sandbox/WoodcutSandbox";

export default function DevPreviewWoodcutPage() {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>나무 자르기 샌드박스 테스트</h1>
      <WoodcutSandbox />
    </div>
  );
}
