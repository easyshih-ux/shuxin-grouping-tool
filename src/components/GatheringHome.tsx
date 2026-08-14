import './GatheringHome.css'

export function GatheringHome({ onStart }: { onStart: () => void }) {
  return <main className="gathering-home" aria-label="SHUXIN 探索者集結首頁">
    <div className="gathering-artwork">
      <img src={`${import.meta.env.BASE_URL}assets/shuxin-gathering-home.png`} alt="SHUXIN 探索者集結；每一次相遇，都是一段共同探索的開始。" />
      <button className="gathering-start-hotspot" type="button" onClick={onStart} onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onStart() }
      }} aria-label="開始集結" />
    </div>
  </main>
}
