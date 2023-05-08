import React, { useContext, useEffect, useState } from "react";
import "./_index.scss";
import { Button } from "react-bootstrap";
import { arrowLeftSvg } from "../../../img/svg";
import { DeckThreadsFormContext } from "./deck-threads-form-manager";
import { _t } from "../../../i18n";
import { UserAvatar } from "../../user-avatar";
import { useMappedStore } from "../../../store/use-mapped-store";
import { AvailableCredits } from "../../available-credits";
import { useLocation } from "react-router";
import { DeckThreadsFormControl } from "./deck-threads-form-control";
import { DeckThreadsFormThreadSelection } from "./deck-threads-form-thread-selection";
import useLocalStorage from "react-use/lib/useLocalStorage";
import { PREFIX } from "../../../util/local-storage";
import { Entry } from "../../../store/entries/types";
import { DeckThreadsCreatedRecently } from "./deck-threads-created-recently";

interface Props {
  className?: string;
  inline?: boolean;
  placeholder?: string;
}

export const DeckThreadsForm = ({ className, inline, placeholder }: Props) => {
  const { global, activeUser, toggleUIProp } = useMappedStore();
  const { setShow, create } = useContext(DeckThreadsFormContext);
  const location = useLocation();

  const [threadHost, setThreadHost] = useLocalStorage(PREFIX + "_dtf_th", "leothreads");
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [disabled, setDisabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  const [lastCreatedThreadItem, setLastCreatedThreadItem] = useState<Entry | undefined>(undefined);

  const submit = async () => {
    if (!activeUser) {
      toggleUIProp("login");
      return;
    }

    if (disabled) {
      return;
    }

    setLoading(true);
    try {
      let content = text;

      if (image) {
        content = `${content}<p>![${imageName ?? ""}](${image})</p>`;
      }

      const threadItem = await create(threadHost!!, content);
      setLastCreatedThreadItem(threadItem);
      setText("");
      _t("decks.threads-form.successfully-created");
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setDisabled(!text || !threadHost);
  }, [text, threadHost]);

  return (
    <div
      className={
        "deck-toolbar-threads-form " +
        (inline ? " inline " : " deck ") +
        (focused ? " focus " : "") +
        className
      }
      onClick={() => setFocused(true)}
    >
      {!inline && (
        <div className="deck-toolbar-threads-form-header">
          <Button variant="link" onClick={() => setShow(false)}>
            {arrowLeftSvg}
          </Button>
          <Button onClick={submit} disabled={disabled || loading}>
            {!activeUser
              ? _t("decks.threads-form.login-and-publish")
              : loading
              ? _t("decks.threads-form.publishing")
              : _t("decks.threads-form.publish")}
          </Button>
        </div>
      )}
      <div className="deck-toolbar-threads-form-content">
        <div className="deck-toolbar-threads-form-body p-3">
          <UserAvatar global={global} username={activeUser?.username ?? ""} size="medium" />
          <div>
            {!inline && (
              <DeckThreadsFormThreadSelection host={threadHost} setHost={setThreadHost} />
            )}
            <DeckThreadsFormControl
              text={text}
              setText={setText}
              selectedImage={image}
              onAddImage={(url, name) => {
                setImage(url);
                setImageName(name);
              }}
              setSelectedImage={setImage}
              placeholder={placeholder}
            />
            {activeUser && inline && (
              <AvailableCredits
                username={activeUser.username}
                operation="comment_operation"
                activeUser={activeUser}
                location={location}
              />
            )}
          </div>
        </div>
        <div className="deck-toolbar-threads-form-bottom">
          <DeckThreadsCreatedRecently
            lastEntry={lastCreatedThreadItem}
            setLastEntry={setLastCreatedThreadItem}
          />
          {!inline && (
            <div className="deck-toolbar-threads-form-footer">
              {activeUser && (
                <AvailableCredits
                  username={activeUser.username}
                  operation="comment_operation"
                  activeUser={activeUser}
                  location={location}
                />
              )}
              <Button href="/submit" target="_blank" variant="outline-primary" size="sm">
                {_t("decks.threads-form.create-regular-post")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export * from "./deck-threads-form-manager";
