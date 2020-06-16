import React, { Component } from "react";
import { AnyAction, bindActionCreators, Dispatch } from "redux";
import { connect } from "react-redux";
import { History, Location } from "history";

import { match } from "react-router";

import { AppState } from "../store";
import { ListStyle, Global } from "../store/global/types";
import { Entries } from "../store/entries/types";
import { Account, State as AccountsState } from "../store/accounts/types";
import { DynamicProps } from "../store/dynamic-props/types";
import { State as TransactionsState } from "../store/transactions/types";

import { toggleListStyle, toggleTheme } from "../store/global";
import { makeGroupKey, fetchEntries } from "../store/entries";
import { addAccount } from "../store/accounts";
import { fetchDynamicProps } from "../store/dynamic-props";
import { fetchTransactions, resetTransactions } from "../store/transactions";

import Meta from "../components/meta";
import Theme from "../components/theme";
import NavBar from "../components/navbar";
import NotFound from "../components/404";
import LinearProgress from "../components/linear-progress/index";
import EntryListLoadingItem from "../components/entry-list-loading-item";
import DetectBottom from "../components/detect-bottom";
import EntryListContent from "../components/entry-list";

import ProfileCard from "../components/profile-card";
import ProfileMenu from "../components/profile-menu";
import ProfileCover from "../components/profile-cover";
import Wallet from "../components/wallet";

import { getAccountFull } from "../api/hive";

import defaults from "../constants/defaults.json";

import { _t } from "../i18n";

import _c from "../util/fix-class-names";

interface MatchParams {
  username: string;
  section?: string;
}

interface Props {
  history: History;
  location: Location;
  match: match<MatchParams>;
  global: Global;
  dynamicProps: DynamicProps;
  entries: Entries;
  accounts: AccountsState;
  transactions: TransactionsState;
  toggleTheme: () => void;
  toggleListStyle: () => void;
  fetchEntries: (what: string, tag: string, more: boolean) => void;
  addAccount: (data: Account) => void;
  fetchDynamicProps: () => void;
  fetchTransactions: (username: string) => void;
  resetTransactions: () => void;
}

interface State {
  loading: boolean;
}

class ProfilePage extends Component<Props, State> {
  state: State = {
    loading: false,
  };

  _mounted: boolean = true;

  async componentDidMount() {
    await this.ensureAccount();

    const { match, global, fetchEntries, fetchDynamicProps, fetchTransactions } = this.props;

    if (match.params.section !== "wallet") {
      // fetch posts
      fetchEntries(global.filter, global.tag, false);
    }

    // fetch global props for wallet
    fetchDynamicProps();

    // fetch wallet transactions
    fetchTransactions(match.params.username);
  }

  componentDidUpdate(prevProps: Readonly<Props>): void {
    const { match, global, fetchEntries, fetchTransactions, resetTransactions } = this.props;
    const { global: pGlobal } = prevProps;

    // username changed. re-fetch wallet transactions
    if (match.params.username !== prevProps.match.params.username) {
      resetTransactions();
      fetchTransactions(global.tag);
    }

    if (match.params.section === "wallet") {
      return;
    }

    // filter or username changed. fetch posts.
    if (!(global.filter === pGlobal.filter && global.tag === pGlobal.tag)) {
      fetchEntries(global.filter, global.tag, false);
    }
  }

  componentWillUnmount() {
    const { resetTransactions } = this.props;

    // reset transactions on unload
    resetTransactions();

    this._mounted = false;
  }

  ensureAccount = async () => {
    const { match, accounts, addAccount } = this.props;

    const username = match.params.username.replace("@", "");
    const account = accounts.find((x) => x.name === username);

    if (!account) {
      this.stateSet({ loading: true });

      try {
        const data = await getAccountFull(username);
        // make sure acccount exists
        if (data.name === username) {
          addAccount(data);
        }
      } catch (e) {}

      this.stateSet({ loading: false });
    }

    return true;
  };

  stateSet = (obj: {}, cb = undefined) => {
    if (this._mounted) {
      this.setState(obj, cb);
    }
  };

  bottomReached = () => {
    const { global, entries, fetchEntries } = this.props;
    const { filter, tag } = global;
    const groupKey = makeGroupKey(filter, tag);

    const data = entries[groupKey];
    const { loading, hasMore } = data;

    if (!loading && hasMore) {
      fetchEntries(filter, tag, true);
    }
  };

  render() {
    const { global, entries, accounts, match } = this.props;
    const { loading } = this.state;

    if (loading) {
      return <LinearProgress />;
    }

    const username = match.params.username.replace("@", "");
    const { section = "blog" } = match.params;
    const account = accounts.find((x) => x.name === username);

    if (!account) {
      return <NotFound />;
    }

    //  Meta config
    const url = `${defaults.base}/@${username}${section ? `/${section}` : ""}`;
    const metaProps = {
      title: account.profile?.name || account.name,
      description: account.profile?.about || "",
      url,
      canonical: url,
      image: `${defaults.imageServer}/u/${username}/avatar/large`,
      rss: `${defaults.base}/@${username}/rss`,
      keywords: `${username}, ${username}'s blog`,
    };

    return (
      <>
        <Meta {...metaProps} />
        <Theme {...this.props} />
        <NavBar {...this.props} />

        <div className="app-content profile-page">
          <div className="profile-side">
            <ProfileCard {...this.props} account={account} />
          </div>
          <div className="content-side">
            <ProfileMenu {...this.props} username={username} section={section} />
            <ProfileCover {...this.props} account={account} />
            {(() => {
              if (section === "wallet") {
                return <Wallet {...this.props} account={account} />;
              }

              const { filter, tag } = global;
              const groupKey = makeGroupKey(filter, tag);
              const data = entries[groupKey];

              if (data !== undefined) {
                const entryList = data?.entries;
                const loading = data?.loading;

                return (
                  <>
                    <div className={_c(`entry-list ${loading ? "loading" : ""}`)}>
                      <div className={_c(`entry-list-body ${global.listStyle === ListStyle.grid ? "grid-view" : ""}`)}>
                        {loading && entryList.length === 0 && <EntryListLoadingItem />}
                        <EntryListContent {...this.props} entries={entryList} />
                      </div>
                    </div>
                    {loading && entryList.length > 0 ? <LinearProgress /> : ""}
                    <DetectBottom onBottom={this.bottomReached} />
                  </>
                );
              }

              return null;
            })()}
          </div>
        </div>
      </>
    );
  }
}

const mapStateToProps = (state: AppState) => ({
  global: state.global,
  entries: state.entries,
  accounts: state.accounts,
  dynamicProps: state.dynamicProps,
  transactions: state.transactions,
});

const mapDispatchToProps = (dispatch: Dispatch<AnyAction>) =>
  bindActionCreators(
    {
      toggleTheme,
      toggleListStyle,
      fetchEntries,
      addAccount,
      fetchDynamicProps,
      fetchTransactions,
      resetTransactions,
    },
    dispatch
  );

export default connect(mapStateToProps, mapDispatchToProps)(ProfilePage);
