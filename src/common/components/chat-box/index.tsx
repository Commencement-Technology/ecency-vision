import React, { useEffect, useRef, useState } from "react";
import useDebounce from "react-use/lib/useDebounce";
import { History } from "history";
import {
  Button,
  Col,
  Form,
  FormControl,
  InputGroup,
  Modal,
  OverlayTrigger,
  Popover,
  Row,
  Spinner
} from "react-bootstrap";
import { Link } from "react-router-dom";
import axios from "axios";
import mediumZoom, { Zoom } from "medium-zoom";

import { ActiveUser } from "../../store/active-user/types";
import { Chat, DirectContactsType } from "../../store/chat/types";
import { Community, ROLES } from "../../store/communities/types";
import { Global, Theme } from "../../store/global/types";
import {
  Channel,
  communityModerator,
  DirectMessage,
  PublicMessage
} from "../../../providers/message-provider-types";

import Tooltip from "../tooltip";
import UserAvatar from "../user-avatar";
import LinearProgress from "../linear-progress";
import EmojiPicker from "../emoji-picker";
import GifPicker from "../gif-picker";
import { error, success } from "../feedback";
import { setNostrkeys } from "../../../providers/message-provider";
import DropDown, { MenuItem } from "../dropdown";

import {
  addMessageSVG,
  expandArrow,
  collapseArrow,
  arrowBackSvg,
  messageSendSvg,
  chevronUpSvg,
  chevronDownSvgForSlider,
  emoticonHappyOutlineSvg,
  gifIcon,
  chatBoxImageSvg,
  linkSvg,
  KebabMenu,
  chatLeaveSvg,
  editSVG,
  keySvg,
  syncSvg
} from "../../img/svg";

import {
  DropDownStyle,
  EmojiPickerStyle,
  GifPickerStyle,
  GIPHGY,
  NOSTRKEY,
  UPLOADING,
  GifImagesStyle
} from "./chat-constants";

import { getPublicKey } from "../../../lib/nostr-tools/keys";
import { dateToFormatted } from "../../helper/parse-date";
import {
  createNoStrAccount,
  formatMessageDate,
  formatMessageTime,
  getProfileMetaData,
  NostrKeysType,
  setProfileMetaData,
  resetProfile,
  getCommunities,
  getPrivateKey
} from "../../helper/chat-utils";
import * as ls from "../../util/local-storage";
import { renderPostBody } from "@ecency/render-helper";
import { getAccessToken } from "../../helper/user-token";
import { _t } from "../../i18n";

import { getAccountFull, lookupAccounts } from "../../api/hive";
import { uploadImage } from "../../api/misc";
import { addImage } from "../../api/private-api";
import { getCommunity } from "../../api/bridge";

import "./index.scss";

export interface profileData {
  joiningData: string;
  about: string | undefined;
  followers: number | undefined;
}

interface Props {
  history: History;
  activeUser: ActiveUser | null;
  global: Global;
  chat: Chat;
  resetChat: () => void;
}

let zoom: Zoom | null = null;
const roles = [ROLES.ADMIN, ROLES.MOD, ROLES.GUEST];

export default function ChatBox(props: Props) {
  const prevPropsRef = useRef(props);
  const popoverRef = useRef(null);
  const chatBodyDivRef = React.createRef<HTMLDivElement>();
  const fileInput = React.createRef<HTMLInputElement>();
  const [expanded, setExpanded] = useState(false);
  const [currentUser, setCurrentUser] = useState("");
  const [isCurrentUser, setIsCurrentUser] = useState(false);
  const [message, setMessage] = useState("");
  const [dMMessage, setDMMessage] = useState("");
  const [isMessageText, setIsMessageText] = useState(false);
  const [profileData, setProfileData] = useState<profileData>();
  const [isScrollToTop, setIsScrollToTop] = useState(false);
  const [isScrollToBottom, setIsScrollToBottom] = useState(false);
  const [showSearchUser, setShowSearchUser] = useState(false);
  const [hasUserJoinedChat, setHasUserJoinedChat] = useState(false);
  const [inProgress, setInProgress] = useState(false);
  const [show, setShow] = useState(false);
  const [activeUserKeys, setActiveUserKeys] = useState<NostrKeysType>();
  const [receiverPubKey, setReceiverPubKey] = useState("");
  const [showSpinner, setShowSpinner] = useState(false);
  const [directMessagesList, setDirectMessagesList] = useState<DirectMessage[]>([]);
  const [isCurrentUserJoined, setIsCurrentUserJoined] = useState(true);
  const [shGif, setShGif] = useState(false);
  const [isCommunity, setIsCommunity] = useState(false);
  const [communityName, setCommunityName] = useState("");
  const [currentCommunity, setCurrentCommunity] = useState<Community>();
  const [currentChannel, setCurrentChannel] = useState<Channel>();
  const [publicMessages, setPublicMessages] = useState<PublicMessage[]>([]);
  const [clickedMessage, setClickedMessage] = useState("");
  const [keyDialog, setKeyDialog] = useState(false);
  const [step, setStep] = useState(0);
  const [communities, setCommunities] = useState<Channel[]>([]);
  const [searchtext, setSearchText] = useState("");
  const [userList, setUserList] = useState<string[]>([]);
  const [user, setUser] = useState("");
  const [role, setRole] = useState("admin");
  const [addRoleError, setAddRoleError] = useState("");
  const [moderator, setModerator] = useState<communityModerator>();
  const [noStrPrivKey, setNoStrPrivKey] = useState("");
  const [chatPrivKey, setChatPrivkey] = useState("");

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const clickedElement = event.target as HTMLElement;
      const isAvatarClicked =
        clickedElement.classList.contains("user-avatar") &&
        clickedElement.classList.contains("medium");
      if (
        popoverRef.current &&
        !(popoverRef.current as HTMLElement).contains(event.target as Node) &&
        !isAvatarClicked
      ) {
        setClickedMessage("");
      }
    };

    if (chatBodyDivRef.current) {
      chatBodyDivRef.current.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      if (chatBodyDivRef.current) {
        chatBodyDivRef.current.removeEventListener("mousedown", handleClickOutside);
      }
    };
  }, [clickedMessage]);

  useEffect(() => {
    setInProgress(false);
  }, [props.chat]);

  useEffect(() => {
    // resetProfile(props.activeUser);
    fetchProfileData();
    setShow(!!props.activeUser?.username);
    const noStrPrivKey = getPrivateKey(props.activeUser?.username!);
    setNoStrPrivKey(noStrPrivKey);
  }, []);

  // useEffect(() => {
  //   if (window.messageService) {
  //     setHasUserJoinedChat(true);
  //   }
  // }, [window?.messageService]);

  useEffect(() => {
    const communities = getCommunities(props.chat.channels, props.chat.leftChannelsList);
    setCommunities(communities);
  }, [props.chat.channels, props.chat.leftChannelsList]);

  useEffect(() => {
    const msgsList = fetchDirectMessages(receiverPubKey!);
    const messages = msgsList.sort((a, b) => a.created - b.created);
    setDirectMessagesList(messages);
  }, [props.chat.directMessages]);

  useEffect(() => {
    const prevProps = prevPropsRef.current;
    if (prevProps.global.theme !== props.global.theme) {
      setBackground();
    }
    if (prevProps.activeUser?.username !== props.activeUser?.username) {
      setIsCommunity(false);
      setIsCurrentUser(false);
      setCurrentUser("");
      setCommunityName("");
    }
    prevPropsRef.current = props;
  }, [props.global.theme, props.activeUser]);

  useEffect(() => {
    scrollerClicked();
    if (directMessagesList.length !== 0 || publicMessages.length !== 0) {
      //Initialize the zooming effect
      zoomInitializer();
    }
  }, [directMessagesList, publicMessages]);

  useEffect(() => {
    if (currentChannel && isCommunity) {
      window?.messageService?.fetchChannel(currentChannel.id);
      const publicMessages = fetchCommunityMessages(currentChannel.id);
      const messages = publicMessages.sort((a, b) => a.created - b.created);
      setPublicMessages(messages);
    }
    scrollerClicked();
  }, [currentChannel, isCommunity, props.chat.publicMessages]);

  useEffect(() => {
    if (isCurrentUser) {
      zoomInitializer();
      scrollerClicked();
    } else {
      scrollerClicked();
    }
  }, [isCurrentUser]);

  useEffect(() => {
    fetchProfileData();
    setShow(!!props.activeUser?.username);
    const msgsList = fetchDirectMessages(receiverPubKey!);
    const messages = msgsList.sort((a, b) => a.created - b.created);
    setDirectMessagesList(messages);
    const noStrPrivKey = getPrivateKey(props.activeUser?.username!);
    setNoStrPrivKey(noStrPrivKey);
  }, [props.activeUser]);

  useEffect(() => {
    if (isCommunity) {
      fetchCommunity();
      scrollerClicked();
      fetchCurrentChannel(communityName);
    }
  }, [isCommunity, communityName]);

  useEffect(() => {
    if (currentUser) {
      const isCurrentUserFound = props.chat.directContacts.some(
        (contact) => contact.name === currentUser
      );
      if (isCurrentUserFound) {
        fetchCurrentUserData();
      } else {
        setInProgress(true);
        fetchCurrentUserData();
      }

      const peer = props.chat.directContacts.find((x) => x.name === currentUser)?.pubkey ?? null;
      setReceiverPubKey(peer!);
      const msgsList = fetchDirectMessages(peer!);
      const messages = msgsList.sort((a, b) => a.created - b.created);
      setDirectMessagesList(messages);
      if (!window.messageService) {
        setNostrkeys(activeUserKeys!);
      }
    } else {
      setIsCurrentUserJoined(true);
      setMessage("");
      setInProgress(false);
      scrollerClicked();
    }
  }, [currentUser]);

  useDebounce(
    async () => {
      if (searchtext.length !== 0) {
        const resp = await lookupAccounts(searchtext, 7);
        setUserList(resp);
        setInProgress(false);
      } else {
        setInProgress(false);
        setUserList([]);
      }
    },
    500,
    [searchtext]
  );

  const fetchCommunity = async () => {
    const community = await getCommunity(communityName, props.activeUser?.username);
    setCurrentCommunity(community!);
    setProfileData({
      joiningData: community?.created_at!,
      about: community?.about,
      followers: community?.subscribers
    });
  };

  const fetchCurrentChannel = (communityName: string) => {
    const item = props.chat.channels.find((channel) => channel.communityName === communityName);
    if (item) {
      const updated = props.chat.updatedChannel
        .filter((x) => x.channelId === item.id)
        .sort((a, b) => b.created - a.created)[0];
      if (updated && currentChannel) {
        const channel = {
          name: updated.name,
          about: updated.about,
          picture: updated.picture,
          communityName: updated.communityName,
          communityModerators: updated.communityModerators,
          id: updated.channelId,
          creator: currentChannel.creator,
          created: currentChannel.created
        };
        setCurrentChannel(channel);
      } else {
        setCurrentChannel(item);
      }
    }
  };

  const formatFollowers = (count: number | undefined) => {
    if (count) {
      return count >= 1e6
        ? (count / 1e6).toLocaleString() + "M"
        : count >= 1e3
        ? (count / 1e3).toLocaleString() + "K"
        : count.toLocaleString();
    }
    return count;
  };

  const zoomInitializer = () => {
    const elements: HTMLElement[] = [
      ...document.querySelectorAll<HTMLElement>(".chat-image img")
    ].filter((x) => x.parentNode?.nodeName !== "A");
    zoom = mediumZoom(elements);
    setBackground();
  };

  const setBackground = () => {
    if (props.global.theme === Theme.day) {
      zoom?.update({ background: "#ffffff" });
    } else {
      zoom?.update({ background: "#131111" });
    }
  };

  const fetchDirectMessages = (peer: string) => {
    for (const item of props.chat.directMessages) {
      if (item.peer === peer) {
        return item.chat;
      }
    }
    return [];
  };

  const fetchCommunityMessages = (channelId: string) => {
    for (const item of props.chat.publicMessages) {
      if (item.channelId === channelId) {
        return item.PublicMessage;
      }
    }
    return [];
  };

  const fetchCurrentUserData = async () => {
    const response = await getAccountFull(currentUser);
    setProfileData({
      joiningData: response.created,
      about: response.profile?.about,
      followers: response.follow_stats?.follower_count
    });
    const { posting_json_metadata } = response;
    const profile = JSON.parse(posting_json_metadata!).profile;
    const { noStrKey } = profile || {};
    setReceiverPubKey(noStrKey);
    setIsCurrentUserJoined(!!noStrKey);
    setInProgress(false);
  };

  const fetchProfileData = async () => {
    const profileData = await getProfileMetaData(props.activeUser?.username!);
    const noStrPrivKey = getPrivateKey(props.activeUser?.username!);
    const activeUserKeys = {
      pub: profileData?.noStrKey,
      priv: noStrPrivKey
    };
    setActiveUserKeys(activeUserKeys);
    const hasNoStrKey = profileData && profileData.hasOwnProperty(NOSTRKEY);
    setHasUserJoinedChat(hasNoStrKey);
    setShow(!!props.activeUser?.username);
  };

  const userClicked = (username: string) => {
    setIsCurrentUser(true);
    setCurrentUser(username);
  };

  const handleMessage = (e: React.ChangeEvent<typeof FormControl & HTMLInputElement>) => {
    setMessage(e.target.value);
    setIsMessageText(e.target.value.length !== 0);
  };

  const sendMessage = () => {
    if (message.length !== 0 && !message.includes(UPLOADING)) {
      setMessage("");
      setIsMessageText(false);
      isCommunity
        ? window?.messageService?.sendPublicMessage(currentChannel!, message, [], "")
        : window.messageService?.sendDirectMessage(receiverPubKey, message);
    }
    if (
      receiverPubKey &&
      !props.chat.directContacts.some((contact) => contact.name === currentUser) &&
      isCurrentUser
    ) {
      window.messageService?.publishContacts(currentUser, receiverPubKey);
    }
  };

  const handleScroll = (event: React.UIEvent<HTMLElement>) => {
    var element = event.currentTarget;
    let srollHeight: number = (element.scrollHeight / 100) * 25;
    const isScrollToTop = !isCurrentUser && !isCommunity && element.scrollTop >= srollHeight;
    const isScrollToBottom =
      (isCurrentUser || isCommunity) &&
      element.scrollTop + chatBodyDivRef?.current?.clientHeight! < element.scrollHeight;
    setIsScrollToTop(isScrollToTop);
    setIsScrollToBottom(isScrollToBottom);
  };

  const scrollerClicked = () => {
    chatBodyDivRef?.current?.scroll({
      top: isCurrentUser || isCommunity ? chatBodyDivRef?.current?.scrollHeight : 0,
      behavior: "auto"
    });
  };

  const scrollToBottom = () => {
    chatBodyDivRef?.current?.scroll({
      top: chatBodyDivRef?.current?.scrollHeight,
      behavior: "auto"
    });
  };

  const handleMessageSvgClick = () => {
    setShowSearchUser(!showSearchUser);
  };

  const handleRefreshSvgClick = () => {
    if (getPrivateKey(props.activeUser?.username!)) {
      setInProgress(true);
      const keys = {
        pub: activeUserKeys?.pub!,
        priv: getPrivateKey(props.activeUser?.username!)
      };
      setNostrkeys(keys);
    } else {
      setNoStrPrivKey("");
    }
  };

  const handleJoinChat = async () => {
    const { resetChat } = props;
    setShowSpinner(true);
    resetChat();
    const keys = createNoStrAccount();
    ls.set(`${props.activeUser?.username}_noStrPrivKey`, keys.priv);
    setNoStrPrivKey(keys.priv);
    await setProfileMetaData(props.activeUser, keys.pub);
    setHasUserJoinedChat(true);
    setNostrkeys(keys);
    window.messageService?.updateProfile({
      name: props.activeUser?.username!,
      about: "",
      picture: ""
    });
    setActiveUserKeys(keys);
    setShowSpinner(false);
  };

  const chatButtonSpinner = (
    <Spinner animation="grow" variant="light" size="sm" style={{ marginRight: "6px" }} />
  );

  const getFormattedDateAndDay = (msg: DirectMessage | PublicMessage, i: number) => {
    const prevMsg = isCurrentUser ? directMessagesList[i - 1] : publicMessages[i - 1];
    const msgDate = formatMessageDate(msg.created);
    const prevMsgDate = prevMsg ? formatMessageDate(prevMsg.created) : null;
    if (msgDate !== prevMsgDate) {
      return (
        <div className="custom-divider">
          <span className="custom-divider-text">{msgDate}</span>
        </div>
      );
    }
    return <></>;
  };

  const handleEmojiSelection = (emoji: string) => {
    setMessage((prevMessage) => prevMessage + emoji);
  };

  const getLastMessage = (pubkey: string) => {
    const msgsList = fetchDirectMessages(pubkey!);
    const messages = msgsList.sort((a, b) => a.created - b.created);
    const lastMessage = messages.slice(-1);
    return lastMessage[0]?.content;
  };

  const handleGifSelection = (gif: string) => {
    isCurrentUser
      ? window.messageService?.sendDirectMessage(receiverPubKey, gif)
      : window?.messageService?.sendPublicMessage(currentChannel!, gif, [], "");
  };

  const toggleGif = (e?: React.MouseEvent<HTMLElement>) => {
    if (e) {
      e.stopPropagation();
    }
    setShGif(!shGif);
  };

  const isMessageGif = (content: string) => {
    return content.includes(GIPHGY);
  };

  const checkFile = (filename: string) => {
    const filenameLow = filename.toLowerCase();
    return ["jpg", "jpeg", "gif", "png"].some((el) => filenameLow.endsWith(el));
  };

  const fileInputChanged = (e: React.ChangeEvent<HTMLInputElement>): void => {
    let files = [...(e.target.files as FileList)].filter((i) => checkFile(i.name)).filter((i) => i);

    const {
      global: { isElectron }
    } = props;

    if (files.length > 0) {
      e.stopPropagation();
      e.preventDefault();
    }

    if (files.length > 1 && isElectron) {
      let isWindows = process.platform === "win32";
      if (isWindows) {
        files = files.reverse();
      }
    }

    files.forEach((file) => upload(file));

    // reset input
    e.target.value = "";
  };

  const upload = async (file: File) => {
    const { activeUser, global } = props;

    const username = activeUser?.username!;

    const tempImgTag = `![Uploading ${file.name} #${Math.floor(Math.random() * 99)}]()\n\n`;

    setMessage(tempImgTag);

    let imageUrl: string;
    try {
      let token = getAccessToken(username);
      if (token) {
        const resp = await uploadImage(file, token);
        imageUrl = resp.url;

        if (global.usePrivate && imageUrl.length > 0) {
          addImage(username, imageUrl).then();
        }

        const imgTag = imageUrl.length > 0 && `![](${imageUrl})\n\n`;

        imgTag && setMessage(imgTag);
        setIsMessageText(true);
      } else {
        error(_t("editor-toolbar.image-error-cache"));
      }
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 413) {
        error(_t("editor-toolbar.image-error-size"));
      } else {
        error(_t("editor-toolbar.image-error"));
      }
      return;
    }
  };

  const isMessageImage = (content: string) => {
    return content.includes("https://images.ecency.com");
  };

  const communityClicked = (community: string, name: string) => {
    setIsCommunity(true);
    setCommunityName(community);
  };

  const getProfileName = (creator: string) => {
    const profile = props.chat.profiles.find((x) => x.creator === creator);
    return profile?.name;
  };

  const sendDM = (name: string, pubkey: string) => {
    if (dMMessage) {
      window.messageService?.sendDirectMessage(pubkey, dMMessage);

      setIsCurrentUser(true);
      setCurrentUser(name);
      setIsCommunity(false);
      setCommunityName("");
      setClickedMessage("");
      setDMMessage("");
    }
  };

  const handleDMChange = (e: React.ChangeEvent<typeof FormControl & HTMLInputElement>) => {
    setDMMessage(e.target.value);
  };

  const handleImageClick = (id: string) => {
    if (clickedMessage === id) {
      popoverRef.current = null;
      setClickedMessage("");
    } else {
      popoverRef.current = null;
      setClickedMessage(id);
    }
  };

  const inviteClicked = (content: string) => {
    const textField = document.createElement("textarea");
    textField.innerText = content;
    document.body.appendChild(textField);
    textField.select();
    document.execCommand("copy");
    textField.remove();
    success(`${isCommunity ? "Link" : "Key"} copied into clipboard`);
  };

  const handleImportChatSubmit = () => {
    try {
      const pubKey = getPublicKey(chatPrivKey);
      if (pubKey === activeUserKeys?.pub) {
        setNoStrPrivKey(chatPrivKey);
        ls.set(`${props.activeUser?.username}_noStrPrivKey`, chatPrivKey);
        const keys = {
          pub: activeUserKeys?.pub!,
          priv: chatPrivKey
        };
        setNostrkeys(keys);
        setStep(4);
        setChatPrivkey("");
      } else {
        setAddRoleError("Invalid Private key");
      }
    } catch (error) {
      setAddRoleError("Invalid Private key");
    }
  };

  const finish = () => {
    setStep(0);
    setKeyDialog(false);
  };

  const updateRole = (
    event: React.ChangeEvent<HTMLSelectElement>,
    moderator: communityModerator
  ) => {
    const selectedRole = event.target.value;
    const moderatorIndex = currentChannel?.communityModerators?.findIndex(
      (mod) => mod.name === moderator.name
    );
    if (moderatorIndex !== -1 && currentChannel) {
      const newUpdatedChannel: Channel = { ...currentChannel };
      const newUpdatedModerator = { ...newUpdatedChannel?.communityModerators![moderatorIndex!] };
      newUpdatedModerator.role = selectedRole;
      newUpdatedChannel!.communityModerators![moderatorIndex!] = newUpdatedModerator;
      setCurrentChannel(newUpdatedChannel);
      window.messageService?.updateChannel(currentChannel, newUpdatedChannel);
      success("Roles updated succesfully");
    }
  };

  const LeaveModal = () => {
    return (
      <>
        <div className="leave-dialog-header border-bottom">
          <div className="leave-dialog-titles">
            <h2 className="leave-main-title">Confirmaton</h2>
          </div>
        </div>
        <div className="leave-dialog-body">Are you sure to leave this community?</div>
        <p className="leave-confirm-buttons">
          <Button
            variant="outline-primary"
            className="close-btn"
            onClick={() => {
              setKeyDialog(false);
              setStep(0);
            }}
          >
            Close
          </Button>
          <Button
            variant="outline-primary"
            className="confirm-btn"
            onClick={() => {
              window?.messageService
                ?.updateLeftChannelList([...props.chat.leftChannelsList!, currentChannel?.id!])
                .then(() => {})
                .finally(() => {
                  setKeyDialog(false);
                  setStep(0);
                  setIsCommunity(false);
                  setCommunityName("");
                });
            }}
          >
            Confirm
          </Button>
        </p>
      </>
    );
  };

  const EditRolesModal = () => {
    return (
      <>
        <div className="add-dialog-header">
          <div className="add-dialog-titles">
            <h4 className="add-main-title">Edit Community Roles</h4>
          </div>
        </div>
        <div className="community-chat-role-edit-dialog-content">
          {inProgress && <LinearProgress />}
          <div className={`add-user-role-form ${inProgress ? "in-progress" : ""}`}>
            <Form.Group as={Row}>
              <Form.Label column={true} sm="2">
                {_t("community-role-edit.username")}
              </Form.Label>
              <Col sm="10">
                <InputGroup>
                  <InputGroup.Prepend>
                    <InputGroup.Text>@</InputGroup.Text>
                  </InputGroup.Prepend>
                  <Form.Control
                    type="text"
                    autoFocus={user === ""}
                    placeholder={_t("community-role-edit.username").toLowerCase()}
                    value={user}
                    onChange={userChanged}
                    className={addRoleError ? "is-invalid" : ""}
                    // ref={this._input}
                  />
                </InputGroup>
                {addRoleError && <Form.Text className="text-danger">{addRoleError}</Form.Text>}
              </Col>
            </Form.Group>
            <Form.Group as={Row}>
              <Form.Label column={true} sm="2">
                {_t("community-role-edit.role")}
              </Form.Label>
              <Col sm="10">
                <Form.Control as="select" value={role} onChange={roleChanged}>
                  {roles.map((r, i) => (
                    <option key={i} value={r}>
                      {r}
                    </option>
                  ))}
                </Form.Control>
              </Col>
            </Form.Group>
            <div className="d-flex justify-content-end">
              <Button
                type="button"
                onClick={addNewRole}
                disabled={inProgress || addRoleError.length !== 0 || user.length === 0}
              >
                Add
              </Button>
            </div>
          </div>
          {currentChannel?.communityModerators?.length !== 0 ? (
            <>
              <table className="table table-striped table-bordered table-roles">
                <thead>
                  <tr>
                    <th style={{ width: "200px" }}>{_t("community.roles-account")}</th>
                    <th style={{ width: "200px" }}>{_t("community.roles-role")}</th>
                  </tr>
                </thead>
                <tbody>
                  {currentChannel?.communityModerators &&
                    currentChannel?.communityModerators!.map((moderator, i) => {
                      return (
                        <tr key={i}>
                          <td>
                            <span className="user">
                              <UserAvatar username={moderator.name} size="medium" />{" "}
                              <span className="username">@{moderator.name}</span>
                            </span>
                          </td>
                          <td>
                            {moderator.name === props.activeUser?.username ? (
                              <p style={{ margin: "5px 0 0 12px" }}>{moderator.role}</p>
                            ) : (
                              <Form.Control
                                as="select"
                                value={moderator.role}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                                  updateRole(e, moderator)
                                }
                              >
                                {roles.map((r, i) => (
                                  <option key={i} value={r}>
                                    {r}
                                  </option>
                                ))}
                              </Form.Control>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </>
          ) : (
            <div className="text-center">
              <p>No admin or moderator for this community chat.</p>
            </div>
          )}
        </div>
      </>
    );
  };

  const ImportChatModal = () => {
    return (
      <>
        <div className="import-chat-dialog-header border-bottom">
          <div className="step-no">1</div>
          <div className="import-chat-dialog-titles">
            <div className="import-chat-main-title">Enter Chat private key</div>
            <div className="import-chat-sub-title">Enter chat private key to import all chats</div>
          </div>
        </div>
        <div className="private-key">
          <Form
            onSubmit={(e: React.FormEvent) => {
              e.preventDefault();
            }}
          >
            <InputGroup>
              <InputGroup.Prepend>
                <InputGroup.Text>{keySvg}</InputGroup.Text>
              </InputGroup.Prepend>
              <Form.Control
                value={chatPrivKey}
                type="password"
                autoFocus={true}
                autoComplete="off"
                placeholder="Chat private key"
                onChange={(e) => setChatPrivkey(e.target.value)}
              />
              <InputGroup.Append>
                <Button onClick={handleImportChatSubmit}>{_t("key-or-hot.sign")}</Button>
              </InputGroup.Append>
            </InputGroup>
            {addRoleError && <Form.Text className="text-danger">{addRoleError}</Form.Text>}
          </Form>
        </div>
      </>
    );
  };

  const chatSuccessModal = () => {
    return (
      <>
        <div className="import-chat-dialog-header border-bottom">
          <div className="step-no">2</div>
          <div className="import-chat-dialog-titles">
            <div className="import-chat-main-title">{_t("manage-authorities.success-title")}</div>
            <div className="import-chat-sub-title">
              {_t("manage-authorities.success-sub-title")}
            </div>
          </div>
        </div>
        <div className="success-dialog-body">
          <div className="success-dialog-content">
            <span>Chats imported successfully </span>
          </div>
          <div className="d-flex justify-content-center">
            <span className="hr-6px-btn-spacer" />
            <Button onClick={finish}>{_t("g.finish")}</Button>
          </div>
        </div>
      </>
    );
  };

  useDebounce(
    async () => {
      if (user.length === 0) {
        setAddRoleError("");
        setInProgress(false);
        return;
      }

      try {
        const profileData = await getProfileMetaData(user);
        if (profileData && profileData.hasOwnProperty(NOSTRKEY)) {
          const alreadyExists = currentChannel?.communityModerators?.some(
            (moderator) => moderator.name === profileData.name
          );
          if (alreadyExists) {
            setAddRoleError("You have already assigned some rule to this user.");
            setInProgress(false);
            return;
          }
          const moderator = {
            name: user,
            pubkey: profileData.noStrKey,
            role: role
          };
          setModerator(moderator);
          setAddRoleError("");
        } else {
          setAddRoleError("You cannot set this user because this user hasn't joined the chat yet.");
        }
      } catch (err) {
        error(err as string);
      }

      setInProgress(false);
    },
    200,
    [user, role]
  );

  const userChanged = (e: React.ChangeEvent<typeof FormControl & HTMLInputElement>) => {
    const { value: user } = e.target;
    setUser(user);
    setInProgress(true);
  };

  const addNewRole = () => {
    const updatedRoles = [...(currentChannel?.communityModerators || []), moderator!];
    const updatedMetaData = {
      name: currentChannel?.name!,
      about: currentChannel?.about!,
      picture: "",
      communityName: currentChannel?.communityName!,
      communityModerators: updatedRoles
    };

    window.messageService?.updateChannel(currentChannel!, updatedMetaData);
    currentChannel?.communityModerators?.push(moderator!);
    const updatedChannel: Channel = {
      ...currentChannel!,
      communityModerators: updatedRoles
    };
    setUser("");
    setCurrentChannel(updatedChannel);
  };

  const roleChanged = (e: React.ChangeEvent<typeof FormControl & HTMLInputElement>) => {
    const { value: role } = e.target;
    setRole(role);
  };

  const leaveClicked = () => {
    setKeyDialog(true);
    setStep(1);
  };

  const editRolesClicked = () => {
    setKeyDialog(true);
    setStep(2);
  };

  const toggleKeyDialog = () => {
    setKeyDialog(!keyDialog);
    setUser("");
    setAddRoleError("");
  };

  const handleBackArrowSvg = () => {
    setCurrentUser("");
    setIsCurrentUser(false);
    setCommunityName("");
    setIsCommunity(false);
    setClickedMessage("");
    setShowSearchUser(false);
    setSearchText("");
  };

  const handleImportChat = () => {
    setKeyDialog(true);

    setStep(3);
  };

  const communityMenuItems: MenuItem[] = [
    {
      label: _t("chat.invite"),
      onClick: () =>
        inviteClicked(
          `http://localhost:3000/created/${currentCommunity?.name}?communityid=${currentChannel?.id}`
        ),
      icon: linkSvg
    },
    {
      label: "Leave",
      onClick: leaveClicked,
      icon: chatLeaveSvg
    },
    ...(props.activeUser?.username === currentChannel?.communityName
      ? [
          {
            label: "Edit Roles",
            onClick: editRolesClicked,
            icon: editSVG
          }
        ]
      : [])
  ];

  const communityMenuConfig = {
    history: props.history,
    label: "",
    icon: KebabMenu,
    items: communityMenuItems
  };

  const menuItems: MenuItem[] = [
    {
      label: "Copy private key",
      onClick: () => inviteClicked(noStrPrivKey),
      icon: linkSvg
    }
  ];

  const menuConfig = {
    history: props.history,
    label: "",
    icon: KebabMenu,
    items: menuItems
  };

  return (
    <>
      {show && (
        <div className={`chatbox-container ${expanded ? "expanded" : ""}`}>
          <div className="chat-header">
            {(currentUser || communityName || showSearchUser) && expanded && (
              <Tooltip content={_t("chat.back")}>
                <div className="back-arrow-image">
                  <span className="back-arrow-svg" onClick={handleBackArrowSvg}>
                    {" "}
                    {arrowBackSvg}
                  </span>
                </div>
              </Tooltip>
            )}
            <div className="message-header-title" onClick={() => setExpanded(!expanded)}>
              {(currentUser || isCommunity) && (
                <p className="user-icon">
                  <UserAvatar
                    username={
                      isCurrentUser ? currentUser : (isCommunity && currentCommunity?.name) || ""
                    }
                    size="small"
                  />
                </p>
              )}

              <p className="message-header-content">
                {currentUser
                  ? currentUser
                  : isCommunity
                  ? currentCommunity?.title
                  : showSearchUser
                  ? "New Message"
                  : "Messages"}
              </p>
            </div>
            <div className="actionable-imgs">
              {!currentUser && hasUserJoinedChat && noStrPrivKey && !isCommunity && (
                <>
                  <div className="message-image" onClick={handleMessageSvgClick}>
                    <Tooltip content={_t("chat.new-message")}>
                      <p className="message-svg">{addMessageSVG}</p>
                    </Tooltip>
                  </div>
                </>
              )}
              {!currentUser && hasUserJoinedChat && noStrPrivKey && (
                <div className="message-image" onClick={handleRefreshSvgClick}>
                  <Tooltip content={_t("chat.refresh")}>
                    <p className="message-svg" style={{ paddingTop: "10px" }}>
                      {syncSvg}
                    </p>
                  </Tooltip>
                </div>
              )}
              <div className="arrow-image">
                <Tooltip content={expanded ? _t("chat.collapse") : _t("chat.expand")}>
                  <p className="arrow-svg" onClick={() => setExpanded(!expanded)}>
                    {expanded ? expandArrow : collapseArrow}
                  </p>
                </Tooltip>
              </div>
              {isCommunity && (
                <div className="community-menu">
                  <DropDown
                    {...communityMenuConfig}
                    float="right"
                    alignBottom={false}
                    noMarginTop={true}
                    style={DropDownStyle}
                  />
                </div>
              )}{" "}
              {!isCommunity && !isCurrentUser && noStrPrivKey && (
                <div className="simple-menu">
                  <DropDown
                    {...menuConfig}
                    float="right"
                    alignBottom={false}
                    noMarginTop={true}
                    style={DropDownStyle}
                  />
                </div>
              )}
            </div>
          </div>

          {inProgress && !isCommunity && !isCurrentUser && <LinearProgress />}

          <div
            className={`chat-body ${
              currentUser ? "current-user" : isCommunity ? "community" : ""
            } ${!hasUserJoinedChat ? "join-chat" : clickedMessage ? "no-scroll" : ""}`}
            ref={chatBodyDivRef}
            onScroll={handleScroll}
          >
            {hasUserJoinedChat ? (
              <>
                {currentUser.length !== 0 || communityName.length !== 0 ? (
                  <div className="chats">
                    <>
                      {" "}
                      <Link
                        to={
                          isCurrentUser
                            ? `/@${currentUser}`
                            : isCommunity
                            ? `/created/${currentCommunity?.name}`
                            : ""
                        }
                      >
                        <div className="user-profile">
                          {profileData?.joiningData && (
                            <div className="user-profile-data">
                              <span className="user-logo">
                                <UserAvatar
                                  username={
                                    isCurrentUser
                                      ? currentUser
                                      : (isCommunity && currentCommunity?.name) || ""
                                  }
                                  size="large"
                                />
                              </span>
                              <h4 className="user-name user-logo ">
                                {isCurrentUser
                                  ? currentUser
                                  : (isCommunity && currentCommunity?.title) || ""}
                              </h4>
                              {profileData.about && (
                                <p className="about user-logo ">{profileData.about}</p>
                              )}

                              <div className="created-date user-logo joining-info">
                                <p>
                                  {" "}
                                  {_t("chat.joined")}{" "}
                                  {dateToFormatted(profileData!.joiningData, "LL")}
                                </p>
                                <p className="followers">
                                  {" "}
                                  {formatFollowers(profileData!.followers)}{" "}
                                  {isCommunity ? _t("chat.subscribers") : _t("chat.followers")}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </Link>
                      {!isCurrentUserJoined && (
                        <p className="not-joined">{_t("chat.not-joined")}</p>
                      )}
                      {isCurrentUser
                        ? directMessagesList.map((msg, i) => {
                            const dayAndMonth = getFormattedDateAndDay(msg, i);
                            let renderedPreview = renderPostBody(
                              msg.content,
                              false,
                              props.global.canUseWebp
                            );

                            renderedPreview = renderedPreview.replace(/<p[^>]*>/g, "");
                            renderedPreview = renderedPreview.replace(/<\/p>/g, "");

                            const isGif = isMessageGif(msg.content);

                            const isImage = isMessageImage(msg.content);

                            return (
                              <React.Fragment key={msg.id}>
                                {dayAndMonth}
                                {msg.creator !== activeUserKeys?.pub ? (
                                  <div key={msg.id} className="message">
                                    <div className="user-img">
                                      <Link to={`/@${currentUser}`}>
                                        <span>
                                          <UserAvatar username={currentUser} size="medium" />
                                        </span>
                                      </Link>
                                    </div>
                                    <div className="user-info">
                                      <p className="user-msg-time">
                                        {formatMessageTime(msg.created)}
                                      </p>
                                      <div
                                        className={`receiver-message-content ${
                                          isGif ? "gif" : ""
                                        } ${isImage ? "chat-image" : ""}`}
                                        dangerouslySetInnerHTML={{ __html: renderedPreview }}
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <div key={msg.id} className="sender">
                                    <p className="sender-message-time">
                                      {formatMessageTime(msg.created)}
                                    </p>
                                    <div className="sender-message">
                                      <div
                                        className={`sender-message-content ${isGif ? "gif" : ""} ${
                                          isImage ? "chat-image" : ""
                                        }`}
                                        dangerouslySetInnerHTML={{ __html: renderedPreview }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </React.Fragment>
                            );
                          })
                        : publicMessages.map((pMsg, i) => {
                            const dayAndMonth = getFormattedDateAndDay(pMsg, i);
                            let renderedPreview = renderPostBody(
                              pMsg.content,
                              false,
                              props.global.canUseWebp
                            );

                            renderedPreview = renderedPreview.replace(/<p[^>]*>/g, "");
                            renderedPreview = renderedPreview.replace(/<\/p>/g, "");

                            const isGif = isMessageGif(pMsg.content);

                            const isImage = isMessageImage(pMsg.content);

                            const name = getProfileName(pMsg.creator);

                            const popover = (
                              <Popover
                                id={`profile-popover`}
                                placement="right"
                                className="profile-popover"
                              >
                                <Popover.Content>
                                  <div className="profile-box" ref={popoverRef}>
                                    <UserAvatar username={name!} size="large" />

                                    <p className="profile-name">{name!}</p>

                                    <Form
                                      onSubmit={(e: React.FormEvent) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        sendDM(name!, pMsg.creator);
                                      }}
                                    >
                                      <InputGroup className="dm-input-group">
                                        <Form.Control
                                          value={dMMessage}
                                          autoFocus={true}
                                          onChange={handleDMChange}
                                          required={true}
                                          type="text"
                                          placeholder={"Send direct message"}
                                          autoComplete="off"
                                          className="dm-chat-input"
                                        />
                                      </InputGroup>
                                    </Form>
                                  </div>
                                </Popover.Content>
                              </Popover>
                            );

                            return (
                              <React.Fragment key={pMsg.id}>
                                {dayAndMonth}
                                {pMsg.creator !== activeUserKeys?.pub ? (
                                  <div key={pMsg.id} className="message">
                                    <div className="community-user-img">
                                      <OverlayTrigger
                                        trigger="click"
                                        placement="right"
                                        show={clickedMessage === pMsg.id}
                                        overlay={popover}
                                        delay={1000}
                                        onToggle={() => handleImageClick(pMsg.id)}
                                      >
                                        <span>
                                          <UserAvatar username={name!} size="medium" />
                                        </span>
                                      </OverlayTrigger>
                                    </div>

                                    <div className="user-info">
                                      <p className="user-msg-time">
                                        <span className="username-community">{name}</span>
                                        {formatMessageTime(pMsg.created)}
                                      </p>
                                      <div
                                        className={`receiver-message-content ${
                                          isGif ? "gif" : ""
                                        } ${isImage ? "chat-image" : ""}`}
                                        dangerouslySetInnerHTML={{ __html: renderedPreview }}
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <div key={pMsg.id} className="sender">
                                    <p className="sender-message-time">
                                      {formatMessageTime(pMsg.created)}
                                    </p>
                                    <div className="sender-message">
                                      <div
                                        className={`sender-message-content ${isGif ? "gif" : ""} ${
                                          isImage ? "chat-image" : ""
                                        }`}
                                        dangerouslySetInnerHTML={{ __html: renderedPreview }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </React.Fragment>
                            );
                          })}
                    </>
                  </div>
                ) : showSearchUser ? (
                  <>
                    <div className="user-search-bar">
                      <Form.Group className="w-100 mb-3">
                        <Form.Control
                          type="text"
                          placeholder={_t("chat.search")}
                          value={searchtext}
                          autoFocus={true}
                          onChange={(e) => {
                            setSearchText(e.target.value);
                            setInProgress(true);
                          }}
                        />
                      </Form.Group>
                    </div>
                    <div className="user-search-suggestion-list">
                      {userList.map((user, index) => {
                        return (
                          <div
                            key={index}
                            className="search-content"
                            onClick={() => {
                              setCurrentUser(user);
                              setIsCurrentUser(true);
                            }}
                          >
                            <div className="search-user-img">
                              <span>
                                <UserAvatar username={user} size="medium" />
                              </span>
                            </div>

                            <div className="search-user-title">
                              <p className="search-username">{user}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    {(props.chat.directContacts.length !== 0 ||
                      (props.chat.channels.length !== 0 && communities.length !== 0)) &&
                    noStrPrivKey ? (
                      <React.Fragment>
                        {props.chat.channels.length !== 0 && communities.length !== 0 && (
                          <>
                            <div className="community-header">Communities</div>
                            {communities.map((channel) => {
                              return (
                                <div key={channel.id} className="chat-content">
                                  <Link to={`/created/${channel.communityName}`}>
                                    <div className="user-img">
                                      <span>
                                        <UserAvatar
                                          username={channel.communityName!}
                                          size="medium"
                                        />
                                      </span>
                                    </div>
                                  </Link>

                                  <div
                                    className="user-title"
                                    onClick={() =>
                                      communityClicked(channel.communityName!, channel.name)
                                    }
                                  >
                                    <p className="username" style={{ paddingTop: "8px" }}>
                                      {channel.name}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                            {props.chat.directContacts.length !== 0 && (
                              <div className="dm-header">DMs</div>
                            )}
                          </>
                        )}
                        {props.chat.directContacts.map((user: DirectContactsType) => {
                          return (
                            <div key={user.pubkey} className="chat-content">
                              <Link to={`/@${user.name}`}>
                                <div className="user-img">
                                  <span>
                                    <UserAvatar username={user.name} size="medium" />
                                  </span>
                                </div>
                              </Link>

                              <div className="user-title" onClick={() => userClicked(user.name)}>
                                <p className="username">{user.name}</p>
                                <p className="last-message">{getLastMessage(user.pubkey)}</p>
                              </div>
                            </div>
                          );
                        })}
                      </React.Fragment>
                    ) : !noStrPrivKey || noStrPrivKey.length === 0 || noStrPrivKey === null ? (
                      <>
                        {/* <p className="no-chat">{_t("chat.no-chat")}</p> */}
                        <div className="start-chat-btn" style={{ marginTop: "25%" }}>
                          <Button variant="primary" onClick={handleImportChat}>
                            Import Chat
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="no-chat">{_t("chat.no-chat")}</p>
                        <div className="start-chat-btn">
                          <Button variant="primary" onClick={() => setShowSearchUser(true)}>
                            {_t("chat.start-chat")}
                          </Button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </>
            ) : (
              <Button className="join-chat-btn" onClick={handleJoinChat}>
                {showSpinner && chatButtonSpinner}
                {_t("chat.join-chat")}
              </Button>
            )}

            {((isScrollToTop && !isCurrentUser) ||
              ((isCurrentUser || isCommunity) && isScrollToBottom)) && (
              <Tooltip
                content={isScrollToTop ? _t("scroll-to-top.title") : _t("chat.scroll-to-bottom")}
              >
                <div
                  className="scroller"
                  style={{ bottom: isCurrentUser && isScrollToBottom ? "20px" : "55px" }}
                  onClick={scrollerClicked}
                >
                  {isCurrentUser || isCommunity ? chevronDownSvgForSlider : chevronUpSvg}
                </div>
              </Tooltip>
            )}
          </div>
          {inProgress && <LinearProgress />}
          {(currentUser || isCommunity) && (
            <div className="chat">
              <div className="chatbox-emoji-picker">
                <div className="chatbox-emoji">
                  <Tooltip content={_t("editor-toolbar.emoji")}>
                    <div className="emoji-icon">{emoticonHappyOutlineSvg}</div>
                  </Tooltip>
                  <EmojiPicker
                    style={EmojiPickerStyle}
                    fallback={(e) => {
                      handleEmojiSelection(e);
                    }}
                  />
                </div>
              </div>

              {message.length === 0 && (
                <React.Fragment>
                  <div className="chatbox-emoji-picker">
                    <div className="chatbox-emoji">
                      <Tooltip content={_t("Gif")}>
                        <div className="emoji-icon" onClick={toggleGif}>
                          {" "}
                          {gifIcon}
                        </div>
                      </Tooltip>
                      {shGif && (
                        <GifPicker
                          style={GifPickerStyle}
                          gifImagesStyle={GifImagesStyle}
                          shGif={true}
                          changeState={(gifState) => {
                            setShGif(gifState!);
                          }}
                          fallback={(e) => {
                            handleGifSelection(e);
                          }}
                        />
                      )}
                    </div>
                  </div>
                  <Tooltip content={"Image"}>
                    <div
                      className="chatbox-image"
                      onClick={(e: React.MouseEvent<HTMLElement>) => {
                        e.stopPropagation();
                        const el = fileInput.current;
                        if (el) el.click();
                      }}
                    >
                      <div className="chatbox-image-icon">{chatBoxImageSvg}</div>
                    </div>
                  </Tooltip>

                  <input
                    onChange={fileInputChanged}
                    className="file-input"
                    ref={fileInput}
                    type="file"
                    accept="image/*"
                    multiple={true}
                    style={{ display: "none" }}
                  />
                </React.Fragment>
              )}

              <Form
                onSubmit={(e: React.FormEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  sendMessage();
                }}
                style={{ width: "100%" }}
              >
                <InputGroup className="chat-input-group">
                  <Form.Control
                    value={message}
                    autoFocus={true}
                    onChange={handleMessage}
                    required={true}
                    type="text"
                    placeholder={_t("chat.start-chat-placeholder")}
                    autoComplete="off"
                    className="chat-input"
                    style={{ maxWidth: "100%", overflowWrap: "break-word" }}
                    disabled={inProgress || receiverPubKey === null || receiverPubKey === undefined}
                  />
                  <InputGroup.Append
                    className={`msg-svg ${isMessageText || message.length !== 0 ? "active" : ""}`}
                    onClick={sendMessage}
                  >
                    {messageSendSvg}
                  </InputGroup.Append>
                </InputGroup>
              </Form>
            </div>
          )}
        </div>
      )}

      {keyDialog && (
        <Modal
          animation={false}
          show={true}
          centered={true}
          onHide={toggleKeyDialog}
          keyboard={false}
          className="chats-dialog modal-thin-header"
          size="lg"
        >
          <Modal.Header closeButton={true} />
          <Modal.Body className="chat-modals-body">
            {step === 1 && LeaveModal()}
            {step === 2 && EditRolesModal()}
            {step === 3 && ImportChatModal()}
            {step === 4 && chatSuccessModal()}
          </Modal.Body>
        </Modal>
      )}
    </>
  );
}
