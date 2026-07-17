import { useEffect, useState } from "react";
import type { AccountConfig } from "./accounts";

export interface AccountPickerProps {
  accounts: AccountConfig[];
  selectedUid: string;
  onSelect: (uid: string) => void;
  currentUid?: string;
  rememberedAccountUids?: string[];
  onSwitchAccount?: (uid: string, password?: string) => Promise<void>;
  onForgetRememberedAccount?: (uid: string) => void;
  switching?: boolean;
  switchTargetUid?: string;
  switchError?: string;
}

export default function AccountPicker({
  accounts,
  selectedUid,
  onSelect,
  currentUid,
  rememberedAccountUids = [],
  onSwitchAccount,
  onForgetRememberedAccount,
  switching = false,
  switchTargetUid,
  switchError = "",
}: AccountPickerProps) {
  const [activeUid, setActiveUid] = useState(selectedUid);
  const [switchPassword, setSwitchPassword] = useState("");

  useEffect(() => {
    setActiveUid(selectedUid);
  }, [selectedUid]);

  const selectedAccount = accounts.find((account) => account.uid === activeUid);
  const isCurrentAccount = activeUid === currentUid;
  const isRemembered = selectedAccount ? rememberedAccountUids.includes(selectedAccount.uid) : false;
  const canSwitch = Boolean(
    currentUid
      && selectedAccount
      && selectedAccount.configured
      && !isCurrentAccount
      && onSwitchAccount,
  );

  function handleSelect(uid: string) {
    setActiveUid(uid);
    setSwitchPassword("");
    onSelect(uid);
  }

  async function handleSwitch() {
    if (!canSwitch || !selectedAccount) return;
    await onSwitchAccount?.(
      selectedAccount.uid,
      isRemembered ? undefined : switchPassword,
    );
    setSwitchPassword("");
  }

  return (
    <section className="account-picker" aria-label="世帯を選択">
      <div className="account-picker-list" role="group" aria-label="世帯一覧">
        {accounts.map((account) => (
          <button
            key={account.uid}
            className={"account-picker-option" + (activeUid === account.uid ? " is-selected" : "")}
            type="button"
            aria-pressed={activeUid === account.uid}
            disabled={!account.configured || switching}
            onClick={() => handleSelect(account.uid)}
          >
            {account.label}{account.configured ? "" : "（準備中）"}
          </button>
        ))}
      </div>

      {canSwitch && selectedAccount && (
        <div className="account-picker-switch">
          {!isRemembered && (
            <label htmlFor="switch-account-password">
              {selectedAccount.label}の合言葉
              <input
                id="switch-account-password"
                type="password"
                autoComplete="current-password"
                value={switchPassword}
                onChange={(event) => setSwitchPassword(event.target.value)}
              />
            </label>
          )}
          <button
            type="button"
            className="account-picker-submit"
            disabled={switching || (!isRemembered && !switchPassword.trim())}
            onClick={() => void handleSwitch()}
          >
            {switching && switchTargetUid === selectedAccount.uid
              ? "切り替え中…"
              : selectedAccount.label + "へ切り替える"}
          </button>
          {isRemembered && onForgetRememberedAccount && (
            <button
              type="button"
              className="account-picker-forget"
              onClick={() => onForgetRememberedAccount(selectedAccount.uid)}
              disabled={switching}
            >
              {selectedAccount.label}の記憶を削除
            </button>
          )}
          {switchError && <p className="session-error" role="alert">{switchError}</p>}
        </div>
      )}
    </section>
  );
}