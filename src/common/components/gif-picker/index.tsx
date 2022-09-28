import React from 'react';

import { FormControl } from 'react-bootstrap';

import BaseComponent from '../base';
import SearchBox from '../search-box';

import { _t } from '../../i18n';

import { insertOrReplace } from '../../util/input-util';

import _ from 'lodash';
import axios from 'axios';
import { GIPHY_API, GIPHY_SEARCH_API, fetchGif } from '../../api/misc';

interface Props {
  fallback?: (e: string) => void;
  shGif: boolean;
  changeState: (gifState?: boolean) => void;
}

interface State {
  data: any[];
  filter: string | null;
  filteredData: any[];
  limit: string;
  offset: string;
  total_count: number;
}

export default class GifPicker extends BaseComponent<Props> {
  state: State = {
    data: [],
    filter: '',
    filteredData: [],
    limit: '50',
    offset: '0',
    total_count: 0,
  };
  _target: HTMLInputElement | null = null;

  handleScroll = async (event: any) => {
    const gifWrapper = event.target;
    if (
      gifWrapper.scrollHeight - gifWrapper.scrollTop ===
      gifWrapper.clientHeight
    )
      return;
    if (
      !this.state.filter &&
      this.state?.data?.length <= this.state.total_count
    ) {
      return this.getGifsData(null, this.state.limit, this.state.offset + 50);
    }

    this.delayedSearch(
      this.state.filter,
      this.state.limit,
      this.state.offset + 50,
    );
    console.log('Fetch more list items!');
  };
  componentDidMount() {
    const gifWrapper = document.querySelector('.emoji-picker');
    gifWrapper?.addEventListener('scroll', this.handleScroll);
    this.getGifsData(null, this.state.limit, this.state.offset);

    this.watchTarget(); // initial

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', this.watchTarget, true);
    }
  }

  componentWillUnmount() {
    const gifWrapper = document.querySelector('.emoji-picker');
    super.componentWillUnmount();
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', this.watchTarget, true);
    }
    gifWrapper?.removeEventListener('scroll', this.handleScroll);
  }

  watchTarget = () => {
    if (document.activeElement?.classList.contains('accepts-emoji')) {
      this._target = document.activeElement as HTMLInputElement;
    }
  };

  getSearchedData = async (
    _filter: string | null,
    limit: string,
    offset: string,
  ) => {
    const { data } = await fetchGif(_filter, limit, offset);
    console.log(data);
    if (_filter?.length) {
      let _data: State = {
        data: this.state.data,
        filteredData: [this.state.filteredData, ...data.data],
        filter: this.state.filter,
        limit: data.pagination.limit,
        offset: data.pagination.offset + 10,
        total_count: data.pagination.total_count,
      };
      this.stateSet(_data);
    }
  };

  getGifsData = async (
    _filter: string | null,
    limit: string,
    offset: string,
  ) => {
    const { data } = await fetchGif(_filter, limit, offset);
    console.log(data.data);
    let _data: State = {
      data: [this.state.data, ...data.data],
      filteredData: this.state.filteredData,
      filter: null,
      limit: this.state.limit,
      offset: data.pagination.offset,
      total_count: data.pagination.total_count,
    };
    this.stateSet(_data);
  };

  itemClicked = (url: string) => {
    let _url = url.split('.gif');
    let gifUrl = _url[0] + '.gif';
    if (this._target) {
      insertOrReplace(this._target, gifUrl);
    } else {
      const { fallback } = this.props;
      if (fallback) fallback(gifUrl);
    }
    this.props.changeState(!this.props.shGif);
  };

  delayedSearch = _.debounce(this.getSearchedData, 2000);

  filterChanged = (
    e: React.ChangeEvent<typeof FormControl & HTMLInputElement>,
  ) => {
    this.setState({ filter: e.target.value });
    this.delayedSearch(e.target.value, this.state.limit, this.state.offset);
  };

  renderEmoji = (gifData: any[] | null) => {
    return gifData?.map((_gif) => {
      return (
        <div className='emoji gifs' key={_gif?.id}>
          <img
            loading='lazy'
            src={_gif?.images?.fixed_height?.url}
            alt="can't fetch :("
            onClick={() => {
              this.itemClicked(_gif?.images?.fixed_height?.url);
            }}
          />
        </div>
      );
    });
  };

  render() {
    const { data, filteredData, filter } = this.state;
    if (!data.length && !filteredData.length) {
      return null;
    }

    return (
      <div className='emoji-picker gif' onScroll={this.handleScroll}>
        <SearchBox
          autoComplete='off'
          autoCorrect='off'
          autoCapitalize='off'
          spellCheck='false'
          placeholder={_t('emoji-picker.filter-placeholder')}
          onChange={this.filterChanged}
        />

        {(() => {
          if (filter) {
            return (
              <div className='emoji-cat-list gif-cat-list'>
                <div className='emoji-cat gif-cat'>
                  <div className='emoji-list gif-list'>
                    {this.renderEmoji(filteredData)}
                  </div>
                </div>
              </div>
            );
          } else {
            return (
              <div className='emoji-cat-list gif-cat-list'>
                <div className='emoji-cat gif-cat'>
                  <div className='emoji-list gif-list'>
                    {this.renderEmoji(data)}
                  </div>
                </div>
              </div>
            );
          }
        })()}
      </div>
    );
  }
}