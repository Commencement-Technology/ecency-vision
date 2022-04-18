import React, {
  createRef,
  LegacyRef,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button, Card } from "react-bootstrap";
import Accordion from "react-bootstrap/Accordion";
import { _t } from "../../i18n";
import {
  chevronDownSvgForSlider,
  chevronUpSvg,
  chevronUpSvgForSlider,
  cogSvg,
  deleteForeverSvg,
  hot,
  refreshSvg,
} from "../../img/svg";
import { ListStyle } from "../../store/global/types";
import { OverlayTrigger, Tooltip } from "react-bootstrap";
import moment from "moment";
import * as ls from "../../util/local-storage";
import { DeckSettings } from "./settings-modal";
import { DeckModel } from '../../store/deck/types';

export interface DeckHeaderProps {
  title: DeckModel['header']['title'];
  icon: DeckModel['header']['icon'];
  updateIntervalMs: DeckModel['header']['updateIntervalMs'];
  reloading?: DeckModel['header']['reloading'];
  index: number;
  onRemove: (option: string) => void;
  onReloadColumn: (option: string) => void;
}

const DeckHeader = ({
  title,
  icon,
  updateIntervalMs,
  index,
  onRemove,
  onReloadColumn,
  reloading,
}: DeckHeaderProps) => {
  const [expanded, setExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  let splittedTitle = title.split("@");
  let onlyTitle = splittedTitle[0];
  let username = splittedTitle[1];
  let tooltip = (
    <Tooltip id="profile-tooltip" style={{ zIndex: 10 }}>
      {_t("decks.header-info")}
    </Tooltip>
  );
  let updateDataInterval;

  useEffect(() => {
    updateDataInterval = setInterval(() => onReloadColumn(title), updateIntervalMs);
    return () => {
      clearInterval(updateIntervalMs);
    }
  }, []);

  return (
    <Accordion className={expanded ? "border-bottom" : ""}>
      <div className="d-flex flex-column border-bottom">
        <div className="d-flex justify-content-between align-items-center deck-header position-relative">
          <div className="d-flex align-items-center">
            <div className="deck-index">{index}</div>
            <div className="d-flex align-items-center ml-3">
              <div className="icon mr-2">{icon || hot}</div>
              <div className="header-title">{onlyTitle}</div>
              {username && (
                <div className="ml-1">
                  <small className="text-lowercase text-secondary">
                    @{username.toLowerCase()}
                  </small>
                </div>
              )}
            </div>
          </div>
          <DeckSettings show={showSettings} title={title} onHide={()=>setShowSettings(false)}/>
          <OverlayTrigger placement="bottom" overlay={tooltip}>
            <Accordion.Toggle
              as={Button}
              variant="link"
              eventKey="0"
              className="p-0"
            >
              <div
                className={`pointer`}
                onClick={() => {
                  setExpanded(!expanded);
                }}
              >
                <span>
                  {expanded ? chevronUpSvgForSlider : chevronDownSvgForSlider}
                </span>
              </div>
            </Accordion.Toggle>
          </OverlayTrigger>
        </div>
      </div>
      <Accordion.Collapse eventKey="0">
        <Card.Body className="p-0 d-flex justify-content-end p-3">
          {title !== _t("decks.trending-topics") && <Button
            size="sm"
            className="d-flex align-items-center mr-3"
            variant="secondary"
            onClick={() => setShowSettings(true)}
          >
            <div className="deck-options-icon d-flex cog-icon">{cogSvg}</div>
          </Button>}
          <Button
            size="sm"
            className="d-flex align-items-center"
            onClick={() => onReloadColumn(title)}
            disabled={reloading}
          >
            {reloading ? (
              <div
                className="spinner-border text-white spinner-border-sm"
                role="status"
              >
                <span className="sr-only">{_t("g.loading")}</span>
              </div>
            ) : (
              <div className="deck-options-icon d-flex">{refreshSvg}</div>
            )}
          </Button>
          <Button
            size="sm"
            className="d-flex align-items-center ml-3"
            variant="danger"
            onClick={() => onRemove(title)}
          >
            <div className="deck-options-icon d-flex">{deleteForeverSvg}</div>
          </Button>
        </Card.Body>
      </Accordion.Collapse>
    </Accordion>
  );
};

export interface DeckProps {
  header: { title: string; icon: any };
  listItemComponent: any;
  index: number;
  data: any[];
  onRemove: (option: string) => void;
  onReloadColumn: (option: string) => void;
  extras: any;
  toggleListStyle: (listStyle: ListStyle) => void;
}

export const Deck = ({
  header,
  listItemComponent: ListItem,
  toggleListStyle,
  index,
  data,
  extras,
  onRemove,
  onReloadColumn,
  ...rest
}: DeckProps) => {
  const notificationTranslated = _t("decks.notifications");
  const containerClass = header.title.includes(notificationTranslated)
    ? "list-body pb-0"
    : "";

  return (
    <div className={`deck mr-3 rounded-top ${containerClass}`}>
      <DeckHeader
        {...header}
        index={index}
        onRemove={onRemove}
        onReloadColumn={onReloadColumn}
      />
      <div
        className={`py-4 pr-4 pl-3 item-container ${
          header.title.includes("Wallet") ? "transaction-list" : ""
        }`}
        // ref={deckItemRef}
        // onScroll={(e) => {
        //   let scrollTopValue = deckItemRef!.current!.scrollTop;
        //   let scrollHeight = deckItemRef!.current!.scrollHeight;
        //   if (scrollHeight - scrollTopValue < 750) {
        //     success("It's near end");
        //   }
        // }}
      >
        {data &&
          data.map((item, index) => (
            <ListItem
              toggleListStyle={toggleListStyle}
              index={index + 1}
              key={`${item.title}-${index}`}
              entry={{ ...item, toggleNotNeeded: true }}
              {...item}
              {...rest}
            />
          ))}

      </div>
    </div>
  );
};
