import { ConstellationSandbox } from "@/components/write/sandbox/ConstellationSandbox";

export default function DevPreviewConstellationPage() {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>별자리 만들기 샌드박스 테스트</h1>
      <ConstellationSandbox />
    </div>
  );
}
