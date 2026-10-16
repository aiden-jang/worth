package com.aidenjang.worth;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

final class Proof {
  static final String ORIGIN = "https://worth.aidenjang.com";
  final String verifier, state;
  final long startedAt;

  Proof(String verifier, String state, long startedAt) {
    this.verifier = verifier;
    this.state = state;
    this.startedAt = startedAt;
  }

  static String secret() {
    byte[] bytes = new byte[32];
    new SecureRandom().nextBytes(bytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }

  static String digest(String value) {
    try {
      return Base64.getUrlEncoder()
          .withoutPadding()
          .encodeToString(
              MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception impossible) {
      throw new IllegalStateException("SHA-256 unavailable", impossible);
    }
  }

  String url() {
    return ORIGIN
        + "/widgets/connect?platform=android&name=Worth%20Android&challenge="
        + digest(verifier)
        + "&state="
        + state;
  }

  String code(String url, long now) {
    try {
      URI uri = new URI(url);
      if (now < startedAt
          || now - startedAt >= 900000
          || !"com.aidenjang.worth".equals(uri.getScheme())
          || uri.getRawAuthority() != null
          || !"/widget-callback".equals(uri.getRawPath())
          || uri.getRawFragment() != null
          || uri.getRawQuery() == null) return null;
      Map<String, String> query = new HashMap<>();
      for (String pair : uri.getRawQuery().split("&", -1)) {
        String[] parts = pair.split("=", 2);
        if (parts.length != 2) return null;
        String key = URLDecoder.decode(parts[0], StandardCharsets.UTF_8.name());
        if (query.put(key, URLDecoder.decode(parts[1], StandardCharsets.UTF_8.name())) != null)
          return null;
      }
      String code = query.get("code");
      return query.size() == 2
              && state.equals(query.get("state"))
              && code != null
              && code.matches("[A-Za-z0-9_-]{43}")
          ? code
          : null;
    } catch (Exception invalid) {
      return null;
    }
  }

  static boolean usable(long updated, long expiry, long now) {
    return updated <= now + 60000 && now < Math.min(expiry, updated + 86400000);
  }
}
