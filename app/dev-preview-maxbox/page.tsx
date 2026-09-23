import { MaxBoxSandbox } from "@/components/write/sandbox/MaxBoxSandbox";

export default function DevPreviewMaxBoxPage() {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>상자 속 사과 샌드박스 테스트</h1>
      <MaxBoxSandbox />
    </div>
  );
}
