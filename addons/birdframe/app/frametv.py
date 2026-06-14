"""Push a JPEG to a Samsung Frame TV's Art Mode, replacing the previous one.

Built on samsungtvws (the same library the core samsungtv integration and
vivalatech's art-changer use). The point of this add-on over a generic
art-changer is that uploads do NOT pile up: each cycle uploads the new collage,
selects it, then deletes the image it replaced. The art library stays at one
Bird image per TV.

State is per-TV (token + current/pending ids keyed by host) so several Frames
can be driven from one add-on.

Safety ordering, per TV:
  1. upload + select the NEW image      (throws -> change nothing; old stays up)
  2. record new id, queue old to delete (durable, before any delete runs)
  3. delete queued old ids               (failures retried next cycle)
Only ids we uploaded are ever deleted.
"""
from __future__ import annotations

import json
import logging
import os
import re

from samsungtvws import SamsungTVWS

log = logging.getLogger("birdframe.frametv")

DEVICE_NAME = "BirdFrame"


def _safe(host: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "_", host)


class FrameTV:
    def __init__(self, host: str, matte: str = "none") -> None:
        self.host = host
        self.matte = matte
        self.token_file = f"/data/tv-token-{_safe(host)}.txt"
        self.state_file = f"/data/state-{_safe(host)}.json"
        self.state = self._load_state()

    def _load_state(self) -> dict:
        if os.path.exists(self.state_file):
            try:
                with open(self.state_file, "r", encoding="utf-8") as fh:
                    data = json.load(fh)
                    data.setdefault("current_content_id", None)
                    data.setdefault("pending_deletes", [])
                    return data
            except (OSError, ValueError):
                pass
        return {"current_content_id": None, "pending_deletes": []}

    def _save_state(self) -> None:
        tmp = self.state_file + ".tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(self.state, fh)
        os.replace(tmp, self.state_file)

    def push(self, jpeg: bytes) -> str | None:
        """Upload+select `jpeg`, replacing this TV's previous Bird image.
        Returns the new content id, or None if the TV has no Art Mode (skipped).
        Raises on a real upload/select failure (old image left intact)."""
        # 45s so there's comfortable time to tap "Allow" on the TV during the
        # one-time pairing; once a token is cached, connects are quick anyway.
        tv = SamsungTVWS(
            host=self.host,
            port=8002,
            token_file=self.token_file,
            name=DEVICE_NAME,
            timeout=45,
        )
        try:
            art = tv.art()
            if not art.supported():
                log.warning("%s has no Art Mode - skipping", self.host)
                return None

            new_id = art.upload(jpeg, file_type="JPEG", matte=self.matte)
            if not new_id:
                raise RuntimeError("upload returned no content id")

            # Don't yank someone off live TV: only force-show when already in
            # Art Mode; otherwise just set the selection for next time.
            show = True
            try:
                if str(art.get_artmode()).lower() == "off":
                    show = False
            except Exception:  # noqa: BLE001
                pass
            art.select_image(new_id, show=show)
            log.info("%s: uploaded + selected %s (show=%s)", self.host, new_id, show)

            old = self.state.get("current_content_id")
            self.state["current_content_id"] = new_id
            if old and old != new_id and old not in self.state["pending_deletes"]:
                self.state["pending_deletes"].append(old)
            self._save_state()

            self._drain_deletes(art, keep=new_id)
            return new_id
        finally:
            try:
                tv.close()
            except Exception:  # noqa: BLE001
                pass

    def _drain_deletes(self, art, keep: str) -> None:
        still_pending = []
        for cid in self.state.get("pending_deletes", []):
            if cid == keep:
                continue
            try:
                art.delete(cid)
                log.info("%s: deleted previous art %s", self.host, cid)
            except Exception as exc:  # noqa: BLE001
                log.warning("%s: delete of %s failed, will retry: %s", self.host, cid, exc)
                still_pending.append(cid)
        self.state["pending_deletes"] = still_pending
        self._save_state()
