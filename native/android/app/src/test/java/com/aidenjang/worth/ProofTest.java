package com.aidenjang.worth;

import static org.junit.Assert.*;

import org.junit.Test;

public class ProofTest {
  @Test
  public void standardS256AndStrictReturn() {
    Proof proof = new Proof("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk", "B".repeat(43), 1000);
    assertEquals("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM", Proof.digest(proof.verifier));
    String code = "A".repeat(43),
        url = "com.aidenjang.worth:/widget-callback?code=" + code + "&state=" + proof.state;
    assertEquals(code, proof.code(url, 1000));
    assertNull(proof.code(url + "&state=elsewhere", 1000));
    assertNull(proof.code(url.replace(":/", "://attacker/"), 1000));
    assertNull(proof.code(url, 901000));
    assertNull(proof.code(url + "#fragment", 1000));
    assertNull(proof.code(url.replace(proof.state, "different"), 1000));
  }

  @Test
  public void snapshotsRejectOldAndFutureCopies() {
    assertTrue(Proof.usable(100000, 200000000, 100000));
    assertFalse(Proof.usable(100000, 200000000, 86500000));
    assertFalse(Proof.usable(100000, 200000000, 0));
    assertFalse(Proof.usable(100000, 200000, 200000));
  }
}
