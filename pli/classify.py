# -*- coding: utf-8 -*-
"""
플리 곡 자동 분류기 — 폴더 안의 곡(mp3/wav)을 분석해서
어느 믹스 테마에 어울리는지 제안하고, 믹스 안의 곡 순서까지 정해준다.

사용법:
    python3 classify.py <곡폴더>

결과:
  1. 화면에 곡별 분석·테마 제안 리포트 출력
  2. <곡폴더>/카탈로그.csv 저장 (엑셀에서 바로 열림)

유료 API를 전혀 쓰지 않는다. 전부 로컬 계산이다.
"""

import csv
import json
import sys
from pathlib import Path

import numpy as np

AUDIO_EXTS = {".mp3", ".wav", ".flac", ".ogg", ".m4a"}
ANALYZE_SECONDS = 90  # 곡 앞부분 90초만 분석 (충분히 정확하고 훨씬 빠름)


def load_themes():
    theme_path = Path(__file__).parent / "themes.json"
    with open(theme_path, encoding="utf-8") as f:
        return json.load(f)["테마"]


def analyze_file(path):
    """곡 하나에서 bpm(빠르기)·energy(힘)·brightness(밝기)를 잰다."""
    import librosa

    y, sr = librosa.load(path, sr=22050, mono=True, duration=ANALYZE_SECONDS)
    if len(y) < sr * 5:
        raise ValueError("곡이 5초보다 짧아 분석할 수 없습니다")

    tempo = librosa.feature.tempo(y=y, sr=sr)
    bpm = float(np.atleast_1d(tempo)[0])
    # 아주 느린 곡은 두 배 빠르게 잡히는 일이 흔해서, 에너지가 낮은데 bpm이 높으면 반으로 접는다
    energy = float(np.mean(librosa.feature.rms(y=y)))
    if bpm > 110 and energy < 0.06:
        bpm /= 2
    brightness = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))
    duration = float(len(y) / sr)
    return {"bpm": round(bpm, 1), "energy": round(energy, 4),
            "brightness": round(brightness), "duration": duration}


def range_score(value, lo, hi):
    """값이 [lo, hi] 범위 안이면 1.0, 벗어날수록 0에 가까워진다."""
    if lo <= value <= hi:
        return 1.0
    width = max(hi - lo, 1e-9)
    dist = (lo - value) if value < lo else (value - hi)
    return max(0.0, 1.0 - dist / width)


def match_themes(feat, themes):
    """모든 테마와 비교해서 (테마, 점수)를 어울리는 순서로 돌려준다."""
    scored = []
    for t in themes:
        s = (range_score(feat["bpm"], *t["bpm"]) * 0.4
             + range_score(feat["energy"], *t["energy"]) * 0.35
             + range_score(feat["brightness"], *t["brightness"]) * 0.25)
        scored.append((t, s))
    scored.sort(key=lambda x: -x[1])
    return scored


def arch_order(tracks):
    """잔잔하게 시작 → 중반에 고조 → 잔잔하게 마무리 순서로 배열한다."""
    asc = sorted(tracks, key=lambda t: t["energy"])
    return asc[0::2] + asc[1::2][::-1]


def fmt_minsec(seconds):
    m, s = divmod(int(seconds), 60)
    return f"{m}:{s:02d}"


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    folder = Path(sys.argv[1])
    if not folder.is_dir():
        print(f"폴더를 찾을 수 없습니다: {folder}")
        sys.exit(1)

    files = sorted(p for p in folder.iterdir() if p.suffix.lower() in AUDIO_EXTS)
    if not files:
        print(f"'{folder}' 안에 곡 파일(mp3/wav)이 없습니다.")
        sys.exit(1)

    themes = load_themes()
    print(f"곡 {len(files)}개를 분석합니다. 곡당 몇 초씩 걸려요...\n")

    results = []
    for i, path in enumerate(files, 1):
        try:
            feat = analyze_file(path)
        except Exception as e:
            print(f"[{i}/{len(files)}] {path.name} — 건너뜀 ({e})")
            continue
        ranked = match_themes(feat, themes)
        (best, best_s), (second, second_s) = ranked[0], ranked[1]
        results.append({"파일": path.name, **feat,
                        "제안1": best, "점수1": best_s,
                        "제안2": second, "점수2": second_s})
        print(f"[{i}/{len(files)}] {path.name}")
        print(f"    빠르기 {feat['bpm']} BPM · 힘 {feat['energy']} · 밝기 {feat['brightness']} Hz")
        print(f"    → {best['번호']}번 「{best['이름']}」 (어울림 {best_s:.0%})"
              f"   차선: {second['번호']}번 「{second['이름']}」 ({second_s:.0%})")

    if not results:
        print("분석에 성공한 곡이 없습니다.")
        sys.exit(1)

    # ── 테마별로 묶어서 곡 순서 제안 ──────────────────────────────
    print("\n" + "=" * 60)
    print("믹스별 곡 순서 제안 (잔잔하게 시작 → 고조 → 마무리)")
    print("=" * 60)
    by_theme = {}
    for r in results:
        by_theme.setdefault(r["제안1"]["번호"], []).append(r)
    for num in sorted(by_theme):
        group = by_theme[num]
        t = group[0]["제안1"]
        total = sum(g["duration"] for g in group)
        print(f"\n■ {num}번 「{t['이름']}」 — {len(group)}곡, 약 {fmt_minsec(total)}")
        for order, g in enumerate(arch_order(group), 1):
            print(f"   {order}. {g['파일']}  ({g['bpm']} BPM, 힘 {g['energy']})")

    # ── 카탈로그 CSV 저장 (엑셀 호환: utf-8-sig) ──────────────────
    csv_path = folder / "카탈로그.csv"
    with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["파일명", "길이", "BPM", "힘(energy)", "밝기(Hz)",
                    "제안 테마", "어울림", "차선 테마", "업로드 상태"])
        for r in results:
            w.writerow([r["파일"], fmt_minsec(r["duration"]), r["bpm"],
                        r["energy"], r["brightness"],
                        f"{r['제안1']['번호']}번 {r['제안1']['이름']}",
                        f"{r['점수1']:.0%}",
                        f"{r['제안2']['번호']}번 {r['제안2']['이름']}",
                        "대기"])
    print(f"\n카탈로그 저장 완료 → {csv_path}")


if __name__ == "__main__":
    main()
