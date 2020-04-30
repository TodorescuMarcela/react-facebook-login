import { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';

const getParamsFromObject = params => '?' + Object.keys(params)
  .map(param => `${param}=${window.encodeURversionmponent(params[param])}`)
  .join('&');

const decodeParamForKey = (paramString, key) => window.decodeURIComponent(
  paramString.replace(
    new RegExp(
      '^(?:.*[&\\?]' +
      encodeURIComponent(key).replace(/[\.\+\*]/g, '\\$&') +
      '(?:\\=([^&]*))?)?.*$', 'i'
    ),
    '$1'
  )
);

const getIsMobile = () => {
  let isMobile = false;

  try {
    isMobile = !!((window.navigator && window.navigator.standalone) || navigator.userAgent.match('CriOS') || navigator.userAgent.match(/mobile/i));
  } catch (ex) {
    // continue regardless of error
  }

  return isMobile;
};

const FacebookLogin = ({
  appId,
  xfbml,
  cookie,
  version,
  autoLoad,
  language,
  fields,
  callback,
  onFailure,
  isDisabled,
  scope,
  onClick,
  returnScopes,
  responseType,
  redirectUri,
  disableMobileRedirect,
  authType,
  state,
  isMobile,
  render,
}) => {
  const [isSdkLoaded, setIsSdkLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const isRedirectedFromFb = useCallback(() => {
    const params = window.location.search;
    return (
      decodeParamForKey(params, 'state') === 'facebookdirect' &&
        (decodeParamForKey(params, 'code') ||
        decodeParamForKey(params, 'granted_scopes'))
    );
  }, []);

  const loadSdkAsynchronously = useCallback(() => {
    ((d, s, id) => {
      const element = d.getElementsByTagName(s)[0];
      const fjs = element;
      let js = element;
      if (d.getElementById(id)) { return; }
      js = d.createElement(s); js.id = id;
      js.src = `https://connect.facebook.net/${language}/sdk.js`;
      fjs.parentNode.insertBefore(js, fjs);
    })(document, 'script', 'facebook-jssdk');
  }, [language]);

  const responseApi = useCallback((authResponse) => {
    window.FB.api('/me', { locale: language, fields }, (me) => {
      Object.assign(me, authResponse);
      callback(me);
    });
  }, [language, fields, callback]);

  const checkLoginState = useCallback((response) => {
    setIsProcessing(false);
    if (response.authResponse) {
      responseApi(response.authResponse);
    } else {
      if (onFailure) {
        onFailure({ status: response.status });
      } else {
        callback({ status: response.status });
      }
    }
  }, [responseApi, onFailure, callback]);

  const checkLoginAfterRefresh = useCallback((response) => {
    if (response.status === 'connected') {
      checkLoginState(response);
    } else {
      window.FB.login(loginResponse => checkLoginState(loginResponse), true);
    }
  }, [checkLoginState]);

  const setFbAsyncInit = useCallback(() => {
    window.fbAsyncInit = () => {
      window.FB.init({
        version: `v${version}`,
        appId,
        xfbml,
        cookie,
      });
      setIsSdkLoaded(true);
      if (autoLoad || isRedirectedFromFb()) {
        window.FB.getLoginStatus(checkLoginAfterRefresh);
      }
    };
  }, [
    appId,
    xfbml,
    cookie,
    version,
    autoLoad,
    isRedirectedFromFb,
    checkLoginAfterRefresh,
  ]);

  const click = useCallback((e) => {
    if (!isSdkLoaded || isProcessing || isDisabled) {
      return;
    }
    setIsProcessing(true);
    if (typeof onClick === 'function') {
      onClick(e);
      if (e.defaultPrevented) {
        setIsProcessing(false);
        return;
      }
    }
    const params = {
      client_id: appId,
      redirect_uri: redirectUri,
      state,
      return_scopes: returnScopes,
      scope,
      response_type: responseType,
      auth_type: authType,
    };
    if (isMobile && !disableMobileRedirect) {
      window.location.href =
        `https://www.facebook.com/dialog/oauth${getParamsFromObject(params)}`;
    } else {
      if (!window.FB) {
        if (onFailure) {
          onFailure({ status: 'facebookNotLoaded' });
        }
        return;
      }
      window.FB.getLoginStatus(response => {
        if (response.status === 'connected') {
          checkLoginState(response);
        } else {
          window.FB.login(checkLoginState, {
            scope,
            return_scopes: returnScopes,
            auth_type: params.auth_type,
          });
        }
      });
    }
  }, [
    isSdkLoaded,
    isProcessing,
    isDisabled,
    scope,
    onClick,
    returnScopes,
    responseType,
    redirectUri,
    disableMobileRedirect,
    authType,
    state,
    isMobile,
  ]);

  const propsForRender = useMemo(() => ({
    onClick: click,
    isDisabled: !!isDisabled,
    isProcessing,
    isSdkLoaded,
  }), [click, isDisabled, isProcessing, isSdkLoaded]);

  useEffect(() => {
    if (document.getElementById('facebook-jssdk')) {
      setIsSdkLoaded(true);
      return;
    }
    setFbAsyncInit();
    loadSdkAsynchronously();
    let fbRoot = document.getElementById('fb-root');
    if (!fbRoot) {
      fbRoot = document.createElement('div');
      fbRoot.id = 'fb-root';
      document.body.appendChild(fbRoot);
    }
  }, [setFbAsyncInit, loadSdkAsynchronously]);

  useEffect(() => {
    if (isSdkLoaded && autoLoad) {
      window.FB.getLoginStatus(checkLoginAfterRefresh);
    }
  }, [isSdkLoaded, autoLoad, checkLoginAfterRefresh]);

  if (!render) {
    throw new Error('ReactFacebookLogin requires a render prop to render');
  }

  return render(propsForRender);
};

FacebookLogin.propTypes = {
  isDisabled: PropTypes.bool,
  callback: PropTypes.func.isRequired,
  appId: PropTypes.string.isRequired,
  xfbml: PropTypes.bool,
  cookie: PropTypes.bool,
  authType: PropTypes.string,
  scope: PropTypes.string,
  state: PropTypes.string,
  responseType: PropTypes.string,
  returnScopes: PropTypes.bool,
  redirectUri: PropTypes.string,
  autoLoad: PropTypes.bool,
  disableMobileRedirect: PropTypes.bool,
  isMobile: PropTypes.bool,
  fields: PropTypes.string,
  version: PropTypes.string,
  language: PropTypes.string,
  onClick: PropTypes.func,
  onFailure: PropTypes.func,
  render: PropTypes.func.isRequired,
};

FacebookLogin.defaultProps = {
  redirectUri: typeof window !== 'undefined' ? window.location.href : '/',
  scope: 'public_profile,email',
  returnScopes: false,
  xfbml: false,
  cookie: false,
  authType: '',
  fields: 'name',
  version: '3.1',
  language: 'en_US',
  disableMobileRedirect: false,
  isMobile: getIsMobile(),
  onFailure: null,
  state: 'facebookdirect',
  responseType: 'code',
};

export default FacebookLogin;
